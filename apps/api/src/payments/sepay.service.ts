import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { OrderStatus, assertTransition } from '../orders/entities/order.entity';

interface SePayWebhookPayload {
  id: number | string;
  accountNumber: string;
  transferType: string;
  transferAmount: number;
  content?: string | null;
  description?: string | null;
}

interface SePayConfig {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

/** Thời gian sống của một phiên thanh toán SePay (1 phút). */
export const SEPAY_PAYMENT_TTL_MS = 60_000;

export type SePayCheckoutStatus = 'PENDING' | 'EXPIRED';

@Injectable()
export class SepayService {
  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

  async createCheckout(userId: string, orderId: number, restart = false) {
    const config = this.getConfig();
    const prisma = this.requireDatabase();
    const idempotencyKey = this.intentKey(orderId);
    const now = Date.now();

    const { payment, expired } = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.userId !== userId) {
        throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
      }
      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.PAYMENT_FAILED
      ) {
        throw new ConflictException(
          'Đơn hàng không còn chờ thanh toán',
        );
      }

      const existing = await tx.payment.findUnique({
        where: {
          userId_idempotencyKey: { userId, idempotencyKey },
        },
      });
      if (existing?.success) {
        throw new ConflictException('Đơn hàng đã được thanh toán');
      }
      if (existing && existing.amount !== order.total) {
        throw new ConflictException(
          'Số tiền đơn hàng đã thay đổi; vui lòng tạo đơn mới',
        );
      }
      if (!existing) {
        const created = await tx.payment.create({
          data: {
            userId,
            orderId,
            idempotencyKey,
            amount: order.total,
            method: 'SEPAY',
            success: false,
            requestFingerprint: JSON.stringify({
              orderId,
              amount: order.total,
              method: 'SEPAY',
            }),
            result: this.pendingResult(orderId, order.status as OrderStatus),
          },
        });
        return { payment: created, expired: false };
      }

      if (!this.isSessionExpired(existing.createdAt, now)) {
        return { payment: existing, expired: false };
      }

      // Phiên đã quá 1 phút. Lần kiểm tra đầu tiên đánh dấu đơn thanh toán lỗi;
      // khi khách bấm "Thanh toán lại" (restart) mới mở phiên mới.
      if (!restart) {
        if (order.status === OrderStatus.PENDING) {
          await tx.order.updateMany({
            where: { id: orderId, status: OrderStatus.PENDING },
            data: { status: OrderStatus.PAYMENT_FAILED },
          });
        }
        const expiredPayment = await tx.payment.update({
          where: { id: existing.id },
          data: {
            result: {
              success: false,
              orderId,
              status: OrderStatus.PAYMENT_FAILED,
              message: 'Phiên thanh toán SePay đã hết hạn',
              expiredAt: new Date(now).toISOString(),
              transferDescription: this.transferDescription(orderId),
            },
          },
        });
        return { payment: expiredPayment, expired: true };
      }

      const renewed = await tx.payment.update({
        where: { id: existing.id },
        data: {
          createdAt: new Date(now),
          result: this.pendingResult(orderId, OrderStatus.PENDING),
        },
      });
      return { payment: renewed, expired: false };
    });

    const transferDescription = this.transferDescription(orderId);
    const qr = new URL('https://vietqr.app/img');
    qr.searchParams.set('acc', config.accountNumber);
    qr.searchParams.set('bank', config.bankCode);
    qr.searchParams.set('amount', String(payment.amount));
    qr.searchParams.set('des', transferDescription);
    qr.searchParams.set('template', 'compact');
    qr.searchParams.set('holder', config.accountName);

    return {
      orderId,
      amount: payment.amount,
      transferDescription,
      bankCode: config.bankCode,
      accountNumber: config.accountNumber,
      accountName: config.accountName,
      qrUrl: qr.toString(),
      status: expired ? ('EXPIRED' as const) : ('PENDING' as const),
      expiresAt: new Date(
        payment.createdAt.getTime() + SEPAY_PAYMENT_TTL_MS,
      ).toISOString(),
    };
  }

  async handleWebhook(
    payload: unknown,
  ): Promise<{ accepted: true; duplicate?: true }> {
    const config = this.getConfig();
    const event = this.parseWebhook(payload);
    if (event.transferType.toLowerCase() !== 'in') {
      throw new BadRequestException('SePay event không phải giao dịch tiền vào');
    }
    if (event.accountNumber !== config.accountNumber) {
      throw new BadRequestException('Giao dịch không thuộc tài khoản nhận đã cấu hình');
    }

    const orderMatch = [event.content, event.description]
      .filter((value): value is string => Boolean(value))
      .map((value) => /\bMAYCHA-?(\d+)\b/i.exec(value))
      .find((match) => match !== null);
    if (!orderMatch) {
      throw new BadRequestException('Nội dung chuyển khoản không hợp lệ');
    }
    const orderId = Number(orderMatch[1]);
    if (!Number.isSafeInteger(orderId)) {
      throw new BadRequestException('Mã đơn hàng không hợp lệ');
    }

    const prisma = this.requireDatabase();
    const transactionId = String(event.id);
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
      }

      const payment = await tx.payment.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: order.userId,
            idempotencyKey: this.intentKey(orderId),
          },
        },
      });
      if (!payment || payment.method !== 'SEPAY') {
        throw new BadRequestException(
          'Không tìm thấy phiên thanh toán SePay cho đơn hàng',
        );
      }
      if (event.transferAmount !== payment.amount) {
        throw new BadRequestException('Số tiền SePay không khớp với đơn hàng');
      }

      const previousResult = this.asJsonObject(payment.result);
      if (payment.success) {
        if (previousResult.sepayTransactionId === transactionId) {
          return { accepted: true, duplicate: true };
        }
        throw new ConflictException(
          'Đơn hàng đã được thanh toán bằng một giao dịch SePay khác',
        );
      }
      if (this.isSessionExpired(payment.createdAt)) {
        throw new ConflictException(
          'Phiên thanh toán SePay đã hết hạn; vui lòng tạo lại mã QR',
        );
      }

      const currentStatus = order.status as OrderStatus;
      if (
        currentStatus !== OrderStatus.PENDING &&
        currentStatus !== OrderStatus.PAYMENT_FAILED
      ) {
        throw new ConflictException(
          'Đơn hàng không còn ở trạng thái chờ thanh toán',
        );
      }
      assertTransition(currentStatus, OrderStatus.PAID);

      const earnedPoints = Math.floor(order.total / 10000);
      const [updated, user] = await Promise.all([
        tx.order.updateMany({
          where: { id: orderId, status: currentStatus },
          data: { status: OrderStatus.PAID },
        }),
        tx.user.update({
          where: { id: order.userId },
          data: { loyaltyPoints: { increment: earnedPoints } },
          select: { loyaltyPoints: true },
        }),
      ]);
      if (updated.count !== 1) {
        throw new ConflictException(
          'Trạng thái đơn vừa thay đổi; SePay cần gửi lại webhook',
        );
      }

      const result: Prisma.InputJsonObject = {
        success: true,
        orderId,
        status: OrderStatus.PAID,
        message: 'Thanh toán SePay thành công',
        earnedLoyaltyPoints: earnedPoints,
        totalLoyaltyPoints: user.loyaltyPoints,
        sepayTransactionId: transactionId,
      };
      await tx.payment.update({
        where: { id: payment.id },
        data: { success: true, result },
      });
      return { accepted: true };
    });
  }

  private getConfig(): SePayConfig {
    const bankCode = process.env.SEPAY_BANK_CODE?.trim();
    const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER?.trim();
    const accountName = process.env.SEPAY_ACCOUNT_NAME?.trim();
    const apiKey = process.env.SEPAY_API_KEY?.trim();
    if (!bankCode || !accountNumber || !accountName || !apiKey) {
      throw new ServiceUnavailableException(
        'Thiếu cấu hình SEPAY_BANK_CODE, SEPAY_ACCOUNT_NUMBER, SEPAY_ACCOUNT_NAME hoặc SEPAY_API_KEY',
      );
    }
    return { bankCode, accountNumber, accountName };
  }

  private requireDatabase(): PrismaService {
    if (!this.prisma) {
      throw new ServiceUnavailableException(
        'Thanh toán SePay cần kết nối cơ sở dữ liệu',
      );
    }
    return this.prisma;
  }

  private parseWebhook(payload: unknown): SePayWebhookPayload {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new BadRequestException('Dữ liệu webhook SePay không hợp lệ');
    }
    const value = payload as Record<string, unknown>;
    const amount = Number(value.transferAmount);
    const transactionId = value.id;
    const validTransactionId =
      (typeof transactionId === 'string' &&
        /^\d{1,30}$/.test(transactionId.trim())) ||
      (typeof transactionId === 'number' &&
        Number.isSafeInteger(transactionId) &&
        transactionId > 0);
    if (
      !validTransactionId ||
      typeof value.accountNumber !== 'string' ||
      typeof value.transferType !== 'string' ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      throw new BadRequestException('Thiếu trường giao dịch bắt buộc của SePay');
    }
    return {
      id: typeof transactionId === 'string' ? transactionId.trim() : transactionId,
      accountNumber: value.accountNumber,
      transferType: value.transferType,
      transferAmount: amount,
      content: typeof value.content === 'string' ? value.content : null,
      description:
        typeof value.description === 'string' ? value.description : null,
    };
  }

  private asJsonObject(value: Prisma.JsonValue): Prisma.JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }
    return value as Prisma.JsonObject;
  }

  /** Trạng thái một phiên SePay còn hiệu lực trong 1 phút kể từ lúc tạo. */
  private isSessionExpired(createdAt: Date, now = Date.now()): boolean {
    return now - createdAt.getTime() >= SEPAY_PAYMENT_TTL_MS;
  }

  private pendingResult(
    orderId: number,
    status: OrderStatus,
  ): Prisma.InputJsonObject {
    return {
      success: false,
      orderId,
      status,
      message: 'Đang chờ SePay xác nhận thanh toán',
      transferDescription: this.transferDescription(orderId),
    };
  }

  private intentKey(orderId: number): string {
    return `sepay-order-${orderId}`;
  }

  private transferDescription(orderId: number): string {
    return `MAYCHA-${orderId}`;
  }
}
