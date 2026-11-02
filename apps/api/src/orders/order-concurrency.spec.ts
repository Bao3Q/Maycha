import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../common/prisma.service';
import { OrderSize } from './dto/create-order.dto';
import { OrderStatus } from './entities/order.entity';

const item = { productId: '1', productName: 'Tea', size: OrderSize.S, qty: 1, unitPrice: 35000 };

describe('Order state and inventory regressions', () => {
  let repo: OrdersRepository;
  let products: ProductsService;
  let orders: OrdersService;
  beforeEach(() => {
    repo = new OrdersRepository();
    products = new ProductsService();
    orders = new OrdersService(repo, products);
  });

  it('rejects skipped steps and backwards transitions, then completes the main flow', async () => {
    const order = await orders.createOrder('u1', { items: [item] });
    await expect(orders.updateOrderStatus('u1', order.id, OrderStatus.READY)).rejects.toThrow(BadRequestException);
    for (const status of [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED]) {
      expect((await orders.updateOrderStatus('u1', order.id, status)).status).toBe(status);
    }
    for (const status of Object.values(OrderStatus)) {
      await expect(orders.updateOrderStatus('u1', order.id, status)).rejects.toThrow(BadRequestException);
    }
    expect((await orders.findMyOrder('u1', order.id)).status).toBe(OrderStatus.COMPLETED);
  });

  it('concurrent cancellation restores stock exactly once', async () => {
    products.setStockForTest('1', 3);
    const order = await orders.createOrder('u1', { items: [item] });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () =>
      orders.updateOrderStatus('u1', order.id, OrderStatus.CANCELLED)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(products.findOne('1')?.stock).toBe(3);
  });

  it('rollback of a failed reservation preserves another successful reservation', async () => {
    products.setStockForTest('1', 3);
    let rejectSave!: (error: Error) => void;
    const pendingSave = new Promise<void>((_, reject) => { rejectSave = reject; });
    const failed = products.withStockReservation([{ productId: '1', qty: 1 }], () => pendingSave);
    const assertion = expect(failed).rejects.toThrow('storage failure');
    const successful = orders.createOrder('u2', { items: [item] });
    rejectSave(new Error('storage failure'));
    await assertion;
    await successful;
    expect(products.findOne('1')?.stock).toBe(2);
    expect(await orders.findMyOrders('u2')).toHaveLength(1);
  });

  it('Prisma path rejects a stale version without creating an order', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: '1', name: 'Tea', stock: 3, version: 7 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      order: { create: jest.fn() },
    };
    const prisma = { $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx) };
    orders = new OrdersService(repo, products, prisma as unknown as PrismaService);
    await expect(orders.createOrder('u1', { items: [item] })).rejects.toThrow(ConflictException);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: '1', version: 7, stock: { gte: 1 } },
      data: { stock: { decrement: 1 }, version: { increment: 1 } },
    });
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
