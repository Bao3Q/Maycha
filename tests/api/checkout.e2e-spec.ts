import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../apps/api/src/app.module';
import { setupApp } from '../../apps/api/src/app.setup';
import { OrdersRepository } from '../../apps/api/src/orders/orders.repository';
import { UsersRepository } from '../../apps/api/src/auth/users.repository';

const SECRET = 'e2e_checkout_secret';

/**
 * Luồng end-to-end của Task 9 (Mục 11 đề bài):
 * đăng ký → đăng nhập → POST /orders → POST /payments → màn hình xác nhận
 * (GET /orders/:id) → lịch sử (GET /orders/me).
 */
describe('Checkout – luồng đặt đơn → thanh toán → xác nhận (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.BCRYPT_ROUNDS = '4';
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    app.get(OrdersRepository).clear();
    app.get(UsersRepository).clear();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function loginAs(email: string): Promise<string> {
    await http()
      .post('/auth/register')
      .send({ email, password: 'matkhau123' })
      .expect(201);
    const res = await http()
      .post('/auth/login')
      .send({ email, password: 'matkhau123' })
      .expect(200);
    return res.body.accessToken as string;
  }

  const cart = {
    items: [
      {
        productId: '4',
        productName: 'Cappuccino',
        size: 'M',
        toppings: [],
        qty: 1,
        unitPrice: 50000,
      },
      {
        productId: '2',
        productName: 'Trà Đào Cam Sả',
        size: 'L',
        toppings: ['Trân châu'],
        qty: 2,
        unitPrice: 54000,
      },
    ],
  };

  it('thanh toán thành công → đơn PAID, hiện ở xác nhận và lịch sử', async () => {
    const token = await loginAs('kh@maycha.vn');
    const auth = { Authorization: `Bearer ${token}` };

    const created = await http()
      .post('/orders')
      .set(auth)
      .send(cart)
      .expect(201);
    expect(created.body).toMatchObject({ status: 'PENDING', total: 158000 });
    const orderId = created.body.id as number;

    const paid = await http()
      .post('/payments')
      .set(auth)
      .send({ orderId, method: 'WALLET', idempotencyKey: 'k-1' })
      .expect(201);
    expect(paid.body).toMatchObject({ success: true, orderId, status: 'PAID' });

    const confirm = await http()
      .get(`/orders/${orderId}`)
      .set(auth)
      .expect(200);
    expect(confirm.body).toMatchObject({
      code: `#${orderId}`,
      status: 'PAID',
      total: 158000,
      itemCount: 3,
    });

    const history = await http().get('/orders/me').set(auth).expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ id: orderId, status: 'PAID' });
  });

  it('thanh toán lỗi → PAYMENT_FAILED, thử lại thành công → PAID', async () => {
    const token = await loginAs('kh2@maycha.vn');
    const auth = { Authorization: `Bearer ${token}` };
    const { body: order } = await http()
      .post('/orders')
      .set(auth)
      .send(cart)
      .expect(201);

    await http()
      .post('/payments')
      .set(auth)
      .send({ orderId: order.id, method: 'FAIL' })
      .expect(201)
      .expect((res) => expect(res.body.status).toBe('PAYMENT_FAILED'));

    await http()
      .get(`/orders/${order.id}`)
      .set(auth)
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('PAYMENT_FAILED'));

    await http()
      .post('/payments')
      .set(auth)
      .send({ orderId: order.id, method: 'CARD' })
      .expect(201)
      .expect((res) => expect(res.body.status).toBe('PAID'));
  });

  it('không xem được đơn của người khác (404)', async () => {
    const tokenA = await loginAs('a@maycha.vn');
    const tokenB = await loginAs('b@maycha.vn');
    const { body: order } = await http()
      .post('/orders')
      .set({ Authorization: `Bearer ${tokenA}` })
      .send(cart)
      .expect(201);

    await http()
      .get(`/orders/${order.id}`)
      .set({ Authorization: `Bearer ${tokenB}` })
      .expect(404);
    await http()
      .get('/orders/me')
      .set({ Authorization: `Bearer ${tokenB}` })
      .expect(200)
      .expect((res) => expect(res.body).toEqual([]));
  });

  describe('validate đầu vào & bảo vệ route', () => {
    it('401 khi đặt đơn / thanh toán không có token', async () => {
      await http().post('/orders').send(cart).expect(401);
      await http()
        .post('/payments')
        .send({ orderId: 1001, method: 'WALLET' })
        .expect(401);
    });

    it('400 khi giỏ hàng rỗng hoặc dữ liệu món sai', async () => {
      const auth = { Authorization: `Bearer ${await loginAs('v@maycha.vn')}` };
      await http().post('/orders').set(auth).send({ items: [] }).expect(400);
      await http()
        .post('/orders')
        .set(auth)
        .send({ items: [{ ...cart.items[0], size: 'XL', qty: 0 }] })
        .expect(400);
    });

    it('400 khi phương thức thanh toán không hợp lệ', async () => {
      const auth = { Authorization: `Bearer ${await loginAs('m@maycha.vn')}` };
      const { body: order } = await http()
        .post('/orders')
        .set(auth)
        .send(cart)
        .expect(201);
      await http()
        .post('/payments')
        .set(auth)
        .send({ orderId: order.id, method: 'CASH' })
        .expect(400);
    });
  });
});
