import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  Post,
} from '@nestjs/common';
import { OrdersRepository } from '../orders/orders.repository';
import { Order, OrderItem, OrderStatus } from '../orders/entities/order.entity';
import {
  OrderResponseDto,
  toOrderResponse,
} from '../orders/dto/order-response.dto';
import { signJwt } from '../common/auth/jwt.util';
import { PrismaService } from '../common/prisma.service';

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
 * Endpoint này hỗ trợ thử màn hình Xác nhận và Lịch sử đơn:
 *  - cấp JWT cho một tài khoản demo cố định (không nhận userId từ client,
 *    nên không thể dùng để giả mạo user thật);
 *  - tạo sẵn vài đơn mẫu với các trạng thái khác nhau (chỉ tạo lần đầu).
 *
 * Tắt cờ thì endpoint trả 404 như không tồn tại.
 */
@Controller('dev')
export class DemoController {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

  @Post('demo-session')
  @HttpCode(HttpStatus.OK)
  async createDemoSession(): Promise<DemoSessionResponse> {
    if (!isDemoEnabled()) {
      throw new NotFoundException();
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('Server chưa cấu hình JWT_SECRET');
    }

    if (this.prisma) {
      await this.prisma.user.upsert({
        where: { id: DEMO_USER_ID },
        create: {
          id: DEMO_USER_ID,
          email: DEMO_USER_EMAIL,
          passwordHash: 'disabled-demo-account',
        },
        update: {},
      });
    }
    if ((await this.ordersRepository.findByUserId(DEMO_USER_ID)).length === 0) {
      await this.seedDemoOrders(new Date());
    }

    return {
      accessToken: signJwt(
        { sub: DEMO_USER_ID, email: DEMO_USER_EMAIL },
        secret,
        8 * 60 * 60,
      ),
      user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL },
      orders: (await this.ordersRepository
        .findByUserId(DEMO_USER_ID))
        .map(toOrderResponse),
    };
  }

  private async seedDemoOrders(now: Date): Promise<void> {
    const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

    // Đơn cũ nhất trước để mã đơn tăng dần theo thời gian.
    await this.createOrder(OrderStatus.COMPLETED, minutesAgo(26 * 60), [
      ['1', 'Trà Sữa Truyền Thống', 'M', ['Trân châu đen'], 1, 35000],
      ['4', 'Cappuccino', 'L', [], 1, 49000],
    ]);
    await this.createOrder(OrderStatus.PAYMENT_FAILED, minutesAgo(45), [
      ['3', 'Cà Phê Sữa Đá', 'M', [], 2, 29000],
    ]);
    await this.createOrder(OrderStatus.PAID, minutesAgo(2), [
      ['4', 'Cappuccino', 'M', [], 1, 45000],
      ['2', 'Trà Đào Cam Sả', 'L', ['Thạch đào'], 2, 39000],
    ]);
  }

  private async createOrder(
    status: OrderStatus,
    createdAt: Date,
    lines: [string, string, OrderItem['size'], string[], number, number][],
  ): Promise<void> {
    const items: Array<Omit<OrderItem, 'id' | 'orderId'>> = lines.map(
      ([productId, productName, size, toppings, qty, unitPrice]) => ({
        productId,
        productName,
        size,
        toppings,
        qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      }),
    );
    const order: Omit<Order, 'id' | 'items'> & {
      items: Array<Omit<OrderItem, 'id' | 'orderId'>>;
    } = {
      userId: DEMO_USER_ID,
      status,
      total: items.reduce((sum, i) => sum + i.lineTotal, 0),
      createdAt,
      updatedAt: createdAt,
      items,
    };
    await this.ordersRepository.create(order);
  }
}
