import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { Order, OrderStatus } from './entities/order.entity';

function makeOrder(overrides: Partial<Order> = {}): Order {
  const createdAt = overrides.createdAt ?? new Date('2026-10-01T08:00:00Z');
  return {
    id: 1001,
    userId: 'u1',
    status: OrderStatus.PAID,
    total: 123000,
    createdAt,
    updatedAt: createdAt,
    items: [
      {
        id: 1,
        orderId: overrides.id ?? 1001,
        productId: '4',
        productName: 'Cappuccino',
        size: 'M',
        toppings: [],
        qty: 1,
        unitPrice: 45000,
        lineTotal: 45000,
      },
      {
        id: 2,
        orderId: overrides.id ?? 1001,
        productId: '2',
        productName: 'Trà Đào Cam Sả',
        size: 'L',
        toppings: ['Trân châu'],
        qty: 2,
        unitPrice: 39000,
        lineTotal: 78000,
      },
    ],
    ...overrides,
  };
}

describe('OrdersService', () => {
  let repo: OrdersRepository;
  let service: OrdersService;

  beforeEach(() => {
    repo = new OrdersRepository();
    service = new OrdersService(repo);
  });

  describe('findMyOrders (GET /orders/me)', () => {
    it('trả mảng rỗng khi user chưa có đơn', async () => {
      expect(await service.findMyOrders('u1')).toEqual([]);
    });

    it('chỉ trả đơn của chính user, mới nhất trước', async () => {
      await repo.save(makeOrder({ id: 1001, createdAt: new Date('2026-10-01') }));
      await repo.save(
        makeOrder({
          id: 1002,
          userId: 'u2',
          createdAt: new Date('2026-10-02'),
        }),
      );
      await repo.save(makeOrder({ id: 1003, createdAt: new Date('2026-10-03') }));

      const result = await service.findMyOrders('u1');

      expect(result.map((o) => o.id)).toEqual([1003, 1001]);
    });

    it('trả đủ thông tin cho màn hình lịch sử / xác nhận', async () => {
      await repo.save(makeOrder());

      const [order] = await service.findMyOrders('u1');

      expect(order).toMatchObject({
        id: 1001,
        code: '#1001',
        status: OrderStatus.PAID,
        total: 123000,
        itemCount: 3,
        createdAt: '2026-10-01T08:00:00.000Z',
      });
      expect(order.items).toHaveLength(2);
      expect(order.items[1]).toMatchObject({
        productName: 'Trà Đào Cam Sả',
        size: 'L',
        qty: 2,
        lineTotal: 78000,
      });
    });

    it('hiển thị đúng mọi trạng thái đơn (PENDING, PAYMENT_FAILED, ...)', async () => {
      await repo.save(makeOrder({ id: 1001, status: OrderStatus.PAYMENT_FAILED }));
      await repo.save(
        makeOrder({
          id: 1002,
          status: OrderStatus.PENDING,
          createdAt: new Date('2026-10-05'),
        }),
      );

      expect((await service.findMyOrders('u1')).map((o) => o.status)).toEqual([
        OrderStatus.PENDING,
        OrderStatus.PAYMENT_FAILED,
      ]);
    });
  });

  describe('findMyOrder (GET /orders/:id)', () => {
    it('trả chi tiết đơn của chính user', async () => {
      await repo.save(makeOrder());

      expect(await service.findMyOrder('u1', 1001)).toMatchObject({
        code: '#1001',
        status: OrderStatus.PAID,
      });
    });

    it('404 khi đơn không tồn tại', async () => {
      await expect(service.findMyOrder('u1', 9999)).rejects.toThrow(NotFoundException);
    });

    it('404 khi xem đơn của người khác', async () => {
      await repo.save(makeOrder({ userId: 'u2' }));

      await expect(service.findMyOrder('u1', 1001)).rejects.toThrow(NotFoundException);
    });
  });

  it('dữ liệu trả về không làm thay đổi dữ liệu đã lưu', async () => {
    await repo.save(makeOrder());

    const order = await service.findMyOrder('u1', 1001);
    order.items[0].qty = 99;

    expect((await service.findMyOrder('u1', 1001)).items[0].qty).toBe(1);
  });
});
