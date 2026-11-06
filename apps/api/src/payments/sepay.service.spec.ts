import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { OrderStatus } from '../orders/entities/order.entity';
import { SEPAY_PAYMENT_TTL_MS, SepayService } from './sepay.service';

describe('SepayService', () => {
  const originalEnv = {
    bankCode: process.env.SEPAY_BANK_CODE,
    accountNumber: process.env.SEPAY_ACCOUNT_NUMBER,
    accountName: process.env.SEPAY_ACCOUNT_NAME,
    apiKey: process.env.SEPAY_API_KEY,
  };

  beforeEach(() => {
    process.env.SEPAY_BANK_CODE = 'MB';
    process.env.SEPAY_ACCOUNT_NUMBER = '1234567890';
    process.env.SEPAY_ACCOUNT_NAME = 'MAYCHA TEST';
    process.env.SEPAY_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    if (originalEnv.bankCode === undefined) delete process.env.SEPAY_BANK_CODE;
    else process.env.SEPAY_BANK_CODE = originalEnv.bankCode;
    if (originalEnv.accountNumber === undefined) {
      delete process.env.SEPAY_ACCOUNT_NUMBER;
    } else {
      process.env.SEPAY_ACCOUNT_NUMBER = originalEnv.accountNumber;
    }
    if (originalEnv.accountName === undefined) {
      delete process.env.SEPAY_ACCOUNT_NAME;
    } else {
      process.env.SEPAY_ACCOUNT_NAME = originalEnv.accountName;
    }
    if (originalEnv.apiKey === undefined) delete process.env.SEPAY_API_KEY;
    else process.env.SEPAY_API_KEY = originalEnv.apiKey;
  });

  function createService() {
    const order = {
      id: 17,
      userId: 'user-1',
      status: OrderStatus.PENDING,
      total: 120000,
    };
    let loyaltyPoints = 5;
    const payment = {
      id: 4,
      userId: 'user-1',
      orderId: 17,
      idempotencyKey: 'sepay-order-17',
      amount: 120000,
      method: 'SEPAY',
      success: false,
      createdAt: new Date(),
      result: { success: false, orderId: 17, status: OrderStatus.PENDING },
    };
    const transaction = {
      order: {
        findUnique: jest.fn(async () => order),
        updateMany: jest.fn(
          async (args: { data: { status: OrderStatus } }) => {
            order.status = args.data.status;
            return { count: 1 };
          },
        ),
      },
      payment: {
        findUnique: jest.fn(async () => payment),
        update: jest.fn(
          async (args: {
            data: {
              success?: boolean;
              result?: Prisma.InputJsonValue;
              createdAt?: Date;
            };
          }) => {
            if (args.data.success !== undefined) {
              payment.success = args.data.success;
            }
            if (args.data.result !== undefined) {
              payment.result = args.data.result as typeof payment.result;
            }
            if (args.data.createdAt) {
              payment.createdAt = args.data.createdAt;
            }
            return payment;
          },
        ),
      },
      user: {
        update: jest.fn(
          async (args: {
            data: { loyaltyPoints: { increment: number } };
          }) => {
            loyaltyPoints += args.data.loyaltyPoints.increment;
            return { loyaltyPoints };
          },
        ),
      },
    };
    const prisma = {
      $transaction: async <T>(
        callback: (tx: Prisma.TransactionClient) => Promise<T>,
      ) => callback(transaction as unknown as Prisma.TransactionClient),
    };
    return {
      service: new SepayService(prisma as unknown as PrismaService),
      transaction,
      order,
      payment,
      getLoyaltyPoints: () => loyaltyPoints,
    };
  }

  const event = {
    id: 98231,
    accountNumber: '1234567890',
    transferType: 'in',
    transferAmount: 120000,
    content: 'MAYCHA-17',
  };

  it('marks the order paid once and treats a repeated webhook as idempotent', async () => {
    const { service, transaction, getLoyaltyPoints } = createService();

    await expect(service.handleWebhook(event)).resolves.toEqual({
      accepted: true,
    });
    await expect(service.handleWebhook(event)).resolves.toEqual({
      accepted: true,
      duplicate: true,
    });

    expect(transaction.order.updateMany).toHaveBeenCalledTimes(1);
    expect(transaction.user.update).toHaveBeenCalledTimes(1);
    expect(getLoyaltyPoints()).toBe(17);
  });

  it('rejects an amount mismatch without changing the order', async () => {
    const { service, transaction } = createService();

    await expect(
      service.handleWebhook({ ...event, transferAmount: 120001 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.order.updateMany).not.toHaveBeenCalled();
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('accepts the order reference without a hyphen', async () => {
    const { service, transaction } = createService();

    await expect(
      service.handleWebhook({ ...event, content: 'MAYCHA17' }),
    ).resolves.toEqual({ accepted: true });
    expect(transaction.order.updateMany).toHaveBeenCalledTimes(1);
  });

  it('expires a SePay session after one minute and marks the order failed', async () => {
    const { service, transaction, order, payment } = createService();
    payment.createdAt = new Date(Date.now() - SEPAY_PAYMENT_TTL_MS - 1_000);

    const checkout = await service.createCheckout('user-1', 17);

    expect(checkout.status).toBe('EXPIRED');
    expect(order.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(transaction.order.updateMany).toHaveBeenCalledTimes(1);
    expect(payment.result.status).toBe(OrderStatus.PAYMENT_FAILED);
  });

  it('rejects a webhook that arrives after the session expired', async () => {
    const { service, transaction, payment } = createService();
    payment.createdAt = new Date(Date.now() - SEPAY_PAYMENT_TTL_MS - 1_000);

    await expect(service.handleWebhook(event)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.order.updateMany).not.toHaveBeenCalled();
  });

  it('renews an expired session when the customer retries', async () => {
    const { service, order, payment } = createService();
    payment.createdAt = new Date(Date.now() - SEPAY_PAYMENT_TTL_MS - 1_000);

    const checkout = await service.createCheckout('user-1', 17, true);

    expect(checkout.status).toBe('PENDING');
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(payment.createdAt.getTime()).toBeGreaterThan(
      Date.now() - SEPAY_PAYMENT_TTL_MS,
    );
  });
});
