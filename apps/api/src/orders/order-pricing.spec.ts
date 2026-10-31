import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { ProductsService } from '../products/products.service';
import { PaymentsService } from '../payments/payments.service';
import { OrderSize } from './dto/create-order.dto';

describe('Server pricing and payment retry', () => {
  const input = {
    productId: '1',
    productName: 'Forged name',
    size: OrderSize.L,
    toppings: ['Trân châu', 'Kem'],
    qty: 2,
    unitPrice: 1,
  };

  it('uses catalog name, size and topping prices despite a forged client price', async () => {
    const service = new OrdersService(
      new OrdersRepository(),
      new ProductsService(),
    );
    const order = await service.createOrder('u1', { items: [input] });
    expect(order.total).toBe(110000);
    expect(order.items[0]).toMatchObject({
      productName: 'Hồng Trà Bí Đao',
      unitPrice: 55000,
      lineTotal: 110000,
    });
  });

  it.each([['Unknown'], ['Kem', 'Kem']])(
    'rejects unknown or duplicate toppings: %j',
    async (...toppings) => {
      const products = new ProductsService();
      const service = new OrdersService(new OrdersRepository(), products);
      await expect(
        service.createOrder('u1', { items: [{ ...input, toppings }] }),
      ).rejects.toThrow();
      expect(products.findOne('1')?.stock).toBe(50);
    },
  );

  it('retries the same failed order without reserving stock twice or awarding points twice', async () => {
    const repo = new OrdersRepository();
    const products = new ProductsService();
    const orders = new OrdersService(repo, products);
    const payments = new PaymentsService(repo);
    const order = await orders.createOrder('u1', { items: [input] });
    await payments.processPayment('u1', {
      orderId: order.id,
      method: 'FAIL',
      idempotencyKey: 'failed',
    });
    const paid = await payments.processPayment('u1', {
      orderId: order.id,
      method: 'CARD',
      idempotencyKey: 'retry',
    });
    await payments.processPayment('u1', {
      orderId: order.id,
      method: 'CARD',
      idempotencyKey: 'retry',
    });
    expect(paid.status).toBe('PAID');
    expect(await orders.findMyOrders('u1')).toHaveLength(1);
    expect(products.findOne('1')?.stock).toBe(48);
    expect(await payments.getLoyaltyPoints('u1')).toBe(11);
  });
});
