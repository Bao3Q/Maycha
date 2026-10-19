import { NotFoundException } from '@nestjs/common';
import { DemoController, DEMO_USER_ID } from './demo.controller';
import { OrdersRepository } from '../orders/orders.repository';
import { verifyJwt } from '../common/auth/jwt.util';

const SECRET = 'demo_spec_secret';

describe('DemoController (POST /dev/demo-session)', () => {
  let repo: OrdersRepository;
  let controller: DemoController;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    repo = new OrdersRepository();
    controller = new DemoController(repo);
    process.env.JWT_SECRET = SECRET;
    process.env.ENABLE_DEMO_SEED = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('404 khi chưa bật ENABLE_DEMO_SEED', async () => {
    delete process.env.ENABLE_DEMO_SEED;
    await expect(controller.createDemoSession()).rejects.toThrow(NotFoundException);
  });

  it('cấp JWT hợp lệ cho tài khoản demo', async () => {
    const res = await controller.createDemoSession();
    const payload = verifyJwt(res.accessToken, SECRET);
    expect(payload.sub).toBe(DEMO_USER_ID);
    expect(res.user.id).toBe(DEMO_USER_ID);
  });

  it('tạo 3 đơn mẫu, mới nhất trước, tổng tiền khớp từng dòng', async () => {
    const { orders } = await controller.createDemoSession();
    expect(orders.map((o) => o.status)).toEqual([
      'PAID',
      'PAYMENT_FAILED',
      'COMPLETED',
    ]);
    for (const o of orders) {
      expect(o.total).toBe(o.items.reduce((s, i) => s + i.lineTotal, 0));
      expect(o.code).toBe(`#${o.id}`);
    }
    expect(await repo.findByUserId(DEMO_USER_ID)).toHaveLength(3);
  });

  it('gọi lại không tạo trùng đơn', async () => {
    await controller.createDemoSession();
    const second = await controller.createDemoSession();
    expect(second.orders).toHaveLength(3);
  });
});
