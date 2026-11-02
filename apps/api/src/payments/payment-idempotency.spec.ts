import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SepayService } from './sepay.service';
import { OrdersRepository } from '../orders/orders.repository';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { OrderSize } from '../orders/dto/create-order.dto';

describe('Payment idempotency regression', () => {
  const user = { id: 'u1', email: 'qa@example.com', role: 'CUSTOMER' as const };
  let orders: OrdersService;
  let payments: PaymentsService;
  let controller: PaymentsController;
  beforeEach(() => {
    const repo = new OrdersRepository();
    orders = new OrdersService(repo, new ProductsService());
    payments = new PaymentsService(repo);
    controller = new PaymentsController(payments, {} as SepayService);
  });
  const body = { items: [{ productId: '1', productName: 'Tea', size: OrderSize.S, qty: 1, unitPrice: 35000 }] };

  it('20 concurrent requests with the same header create one result and award points once', async () => {
    const order = await orders.createOrder(user.id, body);
    const responses = await Promise.all(Array.from({ length: 20 }, () =>
      controller.create(user, { orderId: order.id, method: 'WALLET' }, 'same-key')));
    expect(responses.every(r => r.status === 'PAID' && r.orderId === order.id)).toBe(true);
    expect(responses.filter(r => r.isIdempotent)).toHaveLength(19);
    expect(await payments.getLoyaltyPoints(user.id)).toBe(3);
    expect(await orders.findMyOrders(user.id)).toHaveLength(1);
  });

  it('rejects concurrent reuse of a key for another order', async () => {
    const a = await orders.createOrder(user.id, body);
    const b = await orders.createOrder(user.id, body);
    const results = await Promise.allSettled([a, b].map(order =>
      controller.create(user, { orderId: order.id, method: 'CARD' }, 'collision')));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect(await payments.getLoyaltyPoints(user.id)).toBe(3);
  });

  it('requires a non-empty key at the HTTP boundary', () => {
    const dto = { orderId: 1, method: 'WALLET' as const };
    expect(() => controller.create(user, dto)).toThrow(BadRequestException);
    expect(() => controller.create(user, dto, '   ')).toThrow(BadRequestException);
  });

  it('replays failure and allows a different payment attempt without a new order', async () => {
    const order = await orders.createOrder(user.id, body);
    const failed = { orderId: order.id, method: 'FAIL' as const };
    await controller.create(user, failed, 'failure');
    expect((await controller.create(user, failed, 'failure')).isIdempotent).toBe(true);
    expect((await controller.create(user, { orderId: order.id, method: 'WALLET' }, 'success')).status).toBe('PAID');
    expect(await payments.getLoyaltyPoints(user.id)).toBe(3);
    expect(await orders.findMyOrders(user.id)).toHaveLength(1);
  });
});
