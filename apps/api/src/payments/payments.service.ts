import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
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
  private readonly idempotencyStore = new Map<string, IdempotencyRecord>();
  private readonly loyaltyPointsStore = new Map<string, number>();

  constructor(
    private readonly ordersRepository: OrdersRepository,
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

  async getLoyaltyPoints(userId: string): Promise<number> {
    if (this.prisma) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { loyaltyPoints: true },
      });
      return user?.loyaltyPoints ?? 0;
    }
    return this.loyaltyPointsStore.get(userId) || 0;
  }

  async processPayment(
    userId: string,
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResult> {
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
    const requestFingerprint = JSON.stringify({ orderId, method });

    if (this.prisma) {
      return this.processPersistentPayment(
        userId,
        orderId,
        method,
        idempotencyKey,
        requestFingerprint,
      );
    }

    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    if (order.userId !== userId) {
      throw new BadRequestException('Đơn hàng không thuộc về tài khoản này');
    }

    const storeKey = idempotencyKey
      ? JSON.stringify([userId, idempotencyKey])
      : undefined;
    if (storeKey) {
      const cached = this.idempotencyStore.get(storeKey);
      if (cached) {
        if (cached.requestFingerprint !== requestFingerprint) {
          throw new ConflictException(
            'Idempotency-Key đã được dùng cho một yêu cầu thanh toán khác',
          );
        }
        return { ...cached.result, isIdempotent: true };
      }
    }

    const remember = async (result: PaymentResult): Promise<PaymentResult> => {
      if (storeKey) {
        this.idempotencyStore.set(storeKey, {
          requestFingerprint,
          result: { ...result },
        });
      }
      return result;
    };

    if (order.status === OrderStatus.PAID) {
      return remember({
        success: true,
        orderId: order.id,
        status: order.status,
        message: 'Đơn hàng đã được thanh toán trước đó',
        totalLoyaltyPoints: await this.getLoyaltyPoints(userId),
      });
    }

    if (method === 'FAIL') {
      assertTransition(order.status, OrderStatus.PAYMENT_FAILED);
      order.status = OrderStatus.PAYMENT_FAILED;
      order.updatedAt = new Date();
      await this.ordersRepository.save(order);
      return remember({
        success: false,
        orderId: order.id,
        status: order.status,
        message: 'Thanh toán thất bại',
      });
    }

    assertTransition(order.status, OrderStatus.PAID);
    order.status = OrderStatus.PAID;
    order.updatedAt = new Date();
    await this.ordersRepository.save(order);

    const earnedPoints = Math.floor(order.total / 10000);
    const newTotalPoints =
      (this.loyaltyPointsStore.get(userId) || 0) + earnedPoints;
    this.loyaltyPointsStore.set(userId, newTotalPoints);
    return remember({
      success: true,
      orderId: order.id,
      status: order.status,
      message: 'Thanh toán thành công',
      earnedLoyaltyPoints: earnedPoints,
      totalLoyaltyPoints: newTotalPoints,
    });
  }

  clear(): void {
    this.idempotencyStore.clear();
    this.loyaltyPointsStore.clear();
  }

  private async processPersistentPayment(
    userId: string,
    orderId: number,
    method: string,
    idempotencyKey: string | undefined,
    requestFingerprint: string,
  ): Promise<PaymentResult> {
    try {
      return await this.prisma!.$transaction(async (tx) => {
        const cached = idempotencyKey
          ? await tx.payment.findUnique({
              where: {
                userId_idempotencyKey: { userId, idempotencyKey },
              },
            })
          : null;
        if (cached) {
          if (cached.requestFingerprint !== requestFingerprint) {
            throw new ConflictException(
              'Idempotency-Key đã được dùng cho một yêu cầu thanh toán khác',
            );
          }
          return {
            ...this.deserializePaymentResult(cached.result),
            isIdempotent: true,
          };
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });
        if (!order) {
          throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
        }
        if (order.userId !== userId) {
          throw new BadRequestException('Đơn hàng không thuộc về tài khoản này');
        }

        let result: PaymentResult;
        if (order.status === OrderStatus.PAID) {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { loyaltyPoints: true },
          });
          result = {
            success: true,
            orderId,
            status: OrderStatus.PAID,
            message: 'Đơn hàng đã được thanh toán trước đó',
            totalLoyaltyPoints: user?.loyaltyPoints ?? 0,
          };
        } else if (method === 'FAIL') {
          assertTransition(order.status as OrderStatus, OrderStatus.PAYMENT_FAILED);
          await this.updateOrderStatus(tx, orderId, order.status, OrderStatus.PAYMENT_FAILED);
          result = {
            success: false,
            orderId,
            status: OrderStatus.PAYMENT_FAILED,
            message: 'Thanh toán thất bại',
          };
        } else {
          assertTransition(order.status as OrderStatus, OrderStatus.PAID);
          const earnedPoints = Math.floor(order.total / 10000);
          const [updatedOrder, user] = await Promise.all([
            this.updateOrderStatus(tx, orderId, order.status, OrderStatus.PAID),
            tx.user.update({
              where: { id: userId },
              data: { loyaltyPoints: { increment: earnedPoints } },
              select: { loyaltyPoints: true },
            }),
          ]);
          result = {
            success: true,
            orderId,
            status: updatedOrder,
            message: 'Thanh toán thành công',
            earnedLoyaltyPoints: earnedPoints,
            totalLoyaltyPoints: user.loyaltyPoints,
          };
        }

        const resultJson: Prisma.InputJsonObject = {
          success: result.success,
          orderId: result.orderId,
          status: result.status,
          ...(result.message === undefined ? {} : { message: result.message }),
          ...(result.earnedLoyaltyPoints === undefined
            ? {}
            : { earnedLoyaltyPoints: result.earnedLoyaltyPoints }),
          ...(result.totalLoyaltyPoints === undefined
            ? {}
            : { totalLoyaltyPoints: result.totalLoyaltyPoints }),
        };
        await tx.payment.create({
          data: {
            userId,
            orderId,
            amount: order.total,
            method,
            success: result.success,
            idempotencyKey: idempotencyKey ?? null,
            requestFingerprint,
            result: resultJson,
          },
        });
        return result;
      });
    } catch (error) {
      if (
        idempotencyKey &&
        (this.isUniqueConstraintError(error) || error instanceof ConflictException)
      ) {
        const payment = await this.prisma!.payment.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        });
        if (payment) {
          if (payment.requestFingerprint !== requestFingerprint) {
            throw new ConflictException(
              'Idempotency-Key đã được dùng cho một yêu cầu thanh toán khác',
            );
          }
          return {
            ...this.deserializePaymentResult(payment.result),
            isIdempotent: true,
          };
        }
      }
      throw error;
    }
  }

  private async updateOrderStatus(
    tx: Prisma.TransactionClient,
    orderId: number,
    currentStatus: string,
    nextStatus: OrderStatus,
  ): Promise<OrderStatus> {
    const update = await tx.order.updateMany({
      where: { id: orderId, status: currentStatus as OrderStatus },
      data: { status: nextStatus },
    });
    if (update.count !== 1) {
      throw new ConflictException(
        'Trạng thái đơn hàng vừa được thay đổi, vui lòng thử lại',
      );
    }
    return nextStatus;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private deserializePaymentResult(value: Prisma.JsonValue): PaymentResult {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Stored payment result is not a JSON object');
    }
    const record = value as Prisma.JsonObject;
    const status = record.status;
    if (
      typeof record.success !== 'boolean' ||
      typeof record.orderId !== 'number' ||
      typeof status !== 'string' ||
      !Object.values(OrderStatus).some((validStatus) => validStatus === status)
    ) {
      throw new Error('Stored payment result has an invalid shape');
    }
    return {
      success: record.success,
      orderId: record.orderId,
      status: status as OrderStatus,
      ...(typeof record.message === 'string'
        ? { message: record.message }
        : {}),
      ...(typeof record.earnedLoyaltyPoints === 'number'
        ? { earnedLoyaltyPoints: record.earnedLoyaltyPoints }
        : {}),
      ...(typeof record.totalLoyaltyPoints === 'number'
        ? { totalLoyaltyPoints: record.totalLoyaltyPoints }
        : {}),
    };
  }
}
