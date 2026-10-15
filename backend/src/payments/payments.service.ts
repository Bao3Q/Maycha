import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersRepository } from '../orders/orders.repository';
import { OrderStatus, assertTransition } from '../orders/entities/order.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

export interface PaymentResult {
  success: boolean;
  orderId: number;
  status: OrderStatus;
  message?: string;
  earnedLoyaltyPoints?: number;
  totalLoyaltyPoints?: number;
  isIdempotent?: boolean;
}

interface IdempotencyRecord {
  requestFingerprint: string;
  result: PaymentResult;
}

const ACCEPTED_PAYMENT_METHODS = new Set([
  'WALLET',
  'CARD',
  'MOMO',
  'VNPAY',
  'FAIL',
]);

@Injectable()
export class PaymentsService {
  /** Lưu trữ kết quả thanh toán theo Idempotency-Key (Task 10.2) */
  private readonly idempotencyStore = new Map<string, IdempotencyRecord>();

  /** Lưu trữ điểm thưởng (Loyalty Points) theo userId (Task 10.4) */
  private readonly loyaltyPointsStore = new Map<string, number>();

  constructor(private readonly ordersRepository: OrdersRepository) {}

  /** Lấy tổng điểm tích lũy của khách hàng */
  getLoyaltyPoints(userId: string): number {
    return this.loyaltyPointsStore.get(userId) || 0;
  }

  processPayment(
    userId: string,
    createPaymentDto: CreatePaymentDto,
  ): PaymentResult {
    if (!ACCEPTED_PAYMENT_METHODS.has(createPaymentDto.method)) {
      throw new BadRequestException('Phương thức thanh toán không hợp lệ');
    }

    const { orderId, method } = createPaymentDto;
    const rawIdempotencyKey = createPaymentDto.idempotencyKey;
    if (
      rawIdempotencyKey !== undefined &&
      (typeof rawIdempotencyKey !== 'string' || !rawIdempotencyKey.trim())
    ) {
      throw new BadRequestException('Idempotency-Key không được để trống');
    }
    const idempotencyKey = rawIdempotencyKey?.trim();

    const order = this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Đơn hàng không thuộc về tài khoản này');
    }

    const requestFingerprint = JSON.stringify({ orderId, method });
    const idempotencyStoreKey = idempotencyKey
      ? JSON.stringify([userId, idempotencyKey])
      : undefined;

    if (idempotencyStoreKey) {
      const cached = this.idempotencyStore.get(idempotencyStoreKey);
      if (cached) {
        if (cached.requestFingerprint !== requestFingerprint) {
          throw new ConflictException(
            'Idempotency-Key đã được dùng cho một yêu cầu thanh toán khác',
          );
        }
        return { ...cached.result, isIdempotent: true };
      }
    }

    const rememberResult = (result: PaymentResult): PaymentResult => {
      if (idempotencyStoreKey) {
        this.idempotencyStore.set(idempotencyStoreKey, {
          requestFingerprint,
          result: { ...result },
        });
      }
      return result;
    };

    // Nếu đơn đã PAID trước đó, không thu tiền thêm
    if (order.status === OrderStatus.PAID) {
      const alreadyPaidResult: PaymentResult = {
        success: true,
        orderId: order.id,
        status: order.status,
        message: 'Đơn hàng đã được thanh toán trước đó',
        totalLoyaltyPoints: this.getLoyaltyPoints(userId),
      };
      return rememberResult(alreadyPaidResult);
    }

    // 2. Xử lý kịch bản thất bại
    if (method === 'FAIL') {
      // Kiểm tra chuyển trạng thái theo Order State Machine (Task 10.1)
      assertTransition(order.status, OrderStatus.PAYMENT_FAILED);

      order.status = OrderStatus.PAYMENT_FAILED;
      order.updatedAt = new Date();
      this.ordersRepository.save(order);

      const failResult: PaymentResult = {
        success: false,
        orderId: order.id,
        status: order.status,
        message: 'Thanh toán thất bại',
      };
      return rememberResult(failResult);
    }

    // 3. Xử lý thanh toán thành công -> PAID
    // Kiểm tra chuyển trạng thái hợp lệ (Task 10.1)
    assertTransition(order.status, OrderStatus.PAID);

    order.status = OrderStatus.PAID;
    order.updatedAt = new Date();
    this.ordersRepository.save(order);

    // 4. Cộng điểm thưởng tích lũy (Loyalty Points - Task 10.4):
    // Tỷ lệ: 1 điểm cho mỗi 10.000đ giá trị đơn hàng
    const earnedPoints = Math.floor(order.total / 10000);
    const currentPoints = this.getLoyaltyPoints(userId);
    const newTotalPoints = currentPoints + earnedPoints;
    this.loyaltyPointsStore.set(userId, newTotalPoints);

    const successResult: PaymentResult = {
      success: true,
      orderId: order.id,
      status: order.status,
      message: 'Thanh toán thành công',
      earnedLoyaltyPoints: earnedPoints,
      totalLoyaltyPoints: newTotalPoints,
    };

    return rememberResult(successResult);
  }

  /** Dùng để dọn dẹp state trong test */
  clear(): void {
    this.idempotencyStore.clear();
    this.loyaltyPointsStore.clear();
  }
}
