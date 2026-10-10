import {
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { OrdersRepository } from '../orders/orders.repository';
import { Order, OrderItem, OrderStatus } from '../orders/entities/order.entity';
import {
  OrderResponseDto,
  toOrderResponse,
} from '../orders/dto/order-response.dto';
import { signJwt } from '../common/auth/jwt.util';

export const DEMO_USER_ID = 'demo-user';
export const DEMO_USER_EMAIL = 'demo@maycha.vn';

export interface DemoSessionResponse {
  accessToken: string;
  user: { id: string; email: string };
  orders: OrderResponseDto[];
}

/** Đọc cờ lúc xử lý request (không đọc lúc import, vì main.ts nạp .env sau). */
export function isDemoEnabled(): boolean {
  return process.env.ENABLE_DEMO_SEED === 'true';
}

/**
 * CHỈ DÙNG ĐỂ DEMO – bật bằng ENABLE_DEMO_SEED=true.
 *
 * Khi Task 6 (POST /orders), Task 7 (POST /auth/login) và Task 8
 * (POST /payments) chưa ghép xong, endpoint này giúp demo màn hình
 * Xác nhận & Lịch sử đơn:
 *  - cấp JWT cho một tài khoản demo cố định (không nhận userId từ client,
 *    nên không thể dùng để giả mạo user thật);
 *  - tạo sẵn vài đơn mẫu với các trạng thái khác nhau (chỉ tạo lần đầu).
 *
 * Tắt cờ thì endpoint trả 404 như không tồn tại.
 */
@Controller('dev')
export class DemoController {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  @Post('demo-session')
  @HttpCode(HttpStatus.OK)
  createDemoSession(): DemoSessionResponse {
    if (!isDemoEnabled()) {
      throw new NotFoundException();
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('Server chưa cấu hình JWT_SECRET');
    }

    if (this.ordersRepository.findByUserId(DEMO_USER_ID).length === 0) {
      this.seedDemoOrders(new Date());
    }

    return {
      accessToken: signJwt(
        { sub: DEMO_USER_ID, email: DEMO_USER_EMAIL },
        secret,
        8 * 60 * 60,
      ),
      user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL },
      orders: this.ordersRepository
        .findByUserId(DEMO_USER_ID)
        .map(toOrderResponse),
    };
  }

  private seedDemoOrders(now: Date): void {
    const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

    // Đơn cũ nhất trước để mã đơn tăng dần theo thời gian.
    this.createOrder(OrderStatus.COMPLETED, minutesAgo(26 * 60), [
      ['1', 'Trà Sữa Truyền Thống', 'M', ['Trân châu đen'], 1, 35000],
      ['4', 'Cappuccino', 'L', [], 1, 49000],
    ]);
    this.createOrder(OrderStatus.PAYMENT_FAILED, minutesAgo(45), [
      ['3', 'Cà Phê Sữa Đá', 'M', [], 2, 29000],
    ]);
    this.createOrder(OrderStatus.PAID, minutesAgo(2), [
      ['4', 'Cappuccino', 'M', [], 1, 45000],
      ['2', 'Trà Đào Cam Sả', 'L', ['Thạch đào'], 2, 39000],
    ]);
  }

  private createOrder(
    status: OrderStatus,
    createdAt: Date,
    lines: [string, string, OrderItem['size'], string[], number, number][],
  ): void {
    const id = this.ordersRepository.nextId();
    const items: OrderItem[] = lines.map(
      ([productId, productName, size, toppings, qty, unitPrice]) => ({
        id: this.ordersRepository.nextItemIdValue(),
        orderId: id,
        productId,
        productName,
        size,
        toppings,
        qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      }),
    );
    const order: Order = {
      id,
      userId: DEMO_USER_ID,
      status,
      total: items.reduce((sum, i) => sum + i.lineTotal, 0),
      createdAt,
      updatedAt: createdAt,
      items,
    };
    this.ordersRepository.save(order);
  }
}
