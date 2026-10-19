import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../apps/api/src/app.module';
import { OrdersRepository } from '../../apps/api/src/orders/orders.repository';
import { OrderStatus } from '../../apps/api/src/orders/entities/order.entity';
import { signJwt } from '../../apps/api/src/common/auth/jwt.util';

const SECRET = 'e2e_secret';

describe('Orders – lịch sử & xác nhận đơn (e2e)', () => {
  let app: INestApplication<App>;
  let repo: OrdersRepository;
  const tokenU1 = () => signJwt({ sub: 'u1', email: 'u1@maycha.vn' }, SECRET);
  const tokenU2 = () => signJwt({ sub: 'u2', email: 'u2@maycha.vn' }, SECRET);

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    repo = app.get(OrdersRepository);
    repo.clear();
    const now = new Date('2026-10-07T10:00:00Z');
    await repo.save({
      id: 1042,
      userId: 'u1',
      status: OrderStatus.PAID,
      total: 123000,
      createdAt: now,
      updatedAt: now,
      items: [
        {
          id: 1,
          orderId: 1042,
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
          orderId: 1042,
          productId: '2',
          productName: 'Trà Đào Cam Sả',
          size: 'L',
          toppings: [],
          qty: 2,
          unitPrice: 39000,
          lineTotal: 78000,
        },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /orders/me – 401 khi chưa đăng nhập', () => {
    return request(app.getHttpServer()).get('/orders/me').expect(401);
  });

  it('GET /orders/me – trả lịch sử đơn của user', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders/me')
      .set('Authorization', `Bearer ${tokenU1()}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: 1042,
      code: '#1042',
      status: 'PAID',
      total: 123000,
      itemCount: 3,
    });
  });

  it('GET /orders/me – user khác không thấy đơn của u1', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders/me')
      .set('Authorization', `Bearer ${tokenU2()}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('GET /orders/:id – trả dữ liệu màn hình xác nhận', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders/1042')
      .set('Authorization', `Bearer ${tokenU1()}`)
      .expect(200);

    expect(res.body).toMatchObject({ code: '#1042', status: 'PAID' });
    expect(res.body.items).toHaveLength(2);
  });

  it('GET /orders/:id – 404 với đơn của người khác', () => {
    return request(app.getHttpServer())
      .get('/orders/1042')
      .set('Authorization', `Bearer ${tokenU2()}`)
      .expect(404);
  });

  it('GET /orders/:id – 400 khi id không phải số', () => {
    return request(app.getHttpServer())
      .get('/orders/abc')
      .set('Authorization', `Bearer ${tokenU1()}`)
      .expect(400);
  });

  describe('POST /dev/demo-session', () => {
    afterEach(() => {
      delete process.env.ENABLE_DEMO_SEED;
    });

    it('404 khi chưa bật ENABLE_DEMO_SEED', () => {
      delete process.env.ENABLE_DEMO_SEED;
      return request(app.getHttpServer()).post('/dev/demo-session').expect(404);
    });

    it('token demo xem được lịch sử và màn xác nhận của chính nó', async () => {
      process.env.ENABLE_DEMO_SEED = 'true';
      const session = await request(app.getHttpServer())
        .post('/dev/demo-session')
        .expect(200);
      const token = session.body.accessToken as string;

      const mine = await request(app.getHttpServer())
        .get('/orders/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(mine.body).toHaveLength(3);
      expect(mine.body[0].status).toBe('PAID');

      await request(app.getHttpServer())
        .get(`/orders/${mine.body[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Không xem được đơn #1042 của u1
      await request(app.getHttpServer())
        .get('/orders/1042')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
