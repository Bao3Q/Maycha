import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UsersRepository } from './../src/auth/users.repository';
import { signJwt } from './../src/common/auth/jwt.util';

const SECRET = 'e2e_auth_secret';

describe('Auth – đăng ký / đăng nhập JWT (e2e)', () => {
  let app: INestApplication<App>;
  let users: UsersRepository;

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.BCRYPT_ROUNDS = '4';
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    users = app.get(UsersRepository);
    users.clear();
  });

  afterEach(async () => {
    await app.close();
  });

  const register = (body: object) =>
    request(app.getHttpServer()).post('/auth/register').send(body);
  const login = (body: object) =>
    request(app.getHttpServer()).post('/auth/login').send(body);

  describe('POST /auth/register', () => {
    it('201 – tạo tài khoản, không lộ mật khẩu/hash', async () => {
      const res = await register({
        email: 'kh@maycha.vn',
        password: 'matkhau123',
      }).expect(201);

      expect(res.body).toMatchObject({
        email: 'kh@maycha.vn',
        loyaltyPoints: 0,
      });
      expect(res.body.id).toBeDefined();
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(users.findByEmail('kh@maycha.vn')?.passwordHash).toMatch(
        /^\$2[aby]\$/,
      );
    });

    it('chuẩn hóa email (trim + chữ thường)', async () => {
      const res = await register({
        email: '  KH@Maycha.VN ',
        password: 'matkhau123',
      }).expect(201);
      expect(res.body.email).toBe('kh@maycha.vn');
    });

    it('409 – email đã đăng ký', async () => {
      await register({ email: 'kh@maycha.vn', password: 'matkhau123' }).expect(
        201,
      );
      await register({ email: 'kh@maycha.vn', password: 'matkhau456' }).expect(
        409,
      );
    });

    it('400 – email sai định dạng', () =>
      register({ email: 'khong-phai-email', password: 'matkhau123' }).expect(
        400,
      ));

    it('400 – mật khẩu quá ngắn', () =>
      register({ email: 'kh@maycha.vn', password: '1234567' }).expect(400));

    it('400 – mật khẩu quá dài (> 72 ký tự, giới hạn của bcrypt)', () =>
      register({ email: 'kh@maycha.vn', password: 'a'.repeat(73) }).expect(
        400,
      ));

    it('400 – thiếu field / body rỗng', async () => {
      await register({}).expect(400);
      await register({ email: 'kh@maycha.vn' }).expect(400);
    });

    it('400 – password không phải chuỗi', () =>
      register({ email: 'kh@maycha.vn', password: 12345678 }).expect(400));
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await register({ email: 'kh@maycha.vn', password: 'matkhau123' }).expect(
        201,
      );
    });

    it('200 – trả JWT và thông tin user', async () => {
      const res = await login({
        email: 'kh@maycha.vn',
        password: 'matkhau123',
      }).expect(200);

      expect(res.body.accessToken.split('.')).toHaveLength(3);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: { email: 'kh@maycha.vn', loyaltyPoints: 0 },
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('đăng nhập không phân biệt hoa/thường của email', () =>
      login({ email: 'KH@MAYCHA.VN', password: 'matkhau123' }).expect(200));

    it('401 – sai mật khẩu', () =>
      login({ email: 'kh@maycha.vn', password: 'sai-mat-khau' }).expect(401));

    it('401 – email không tồn tại', () =>
      login({ email: 'khong-co@maycha.vn', password: 'matkhau123' }).expect(
        401,
      ));

    it('400 – thiếu mật khẩu / email sai định dạng', async () => {
      await login({ email: 'kh@maycha.vn' }).expect(400);
      await login({ email: 'abc', password: 'matkhau123' }).expect(400);
    });
  });

  describe('Guard bảo vệ route cần đăng nhập (route đặt đơn /orders)', () => {
    it('401 – không có token', () =>
      request(app.getHttpServer()).get('/orders/me').expect(401));

    it('401 – token giả (sai chữ ký)', () =>
      request(app.getHttpServer())
        .get('/orders/me')
        .set(
          'Authorization',
          `Bearer ${signJwt({ sub: 'x', email: 'x@y.z' }, 'khoa_gia')}`,
        )
        .expect(401));

    it('200 – dùng token từ /auth/login vào được route được bảo vệ', async () => {
      await register({ email: 'kh@maycha.vn', password: 'matkhau123' }).expect(
        201,
      );
      const { body } = await login({
        email: 'kh@maycha.vn',
        password: 'matkhau123',
      }).expect(200);

      await request(app.getHttpServer())
        .get('/orders/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
    });

    it('401 – token hết hạn', () =>
      request(app.getHttpServer())
        .get('/orders/me')
        .set('Authorization', `Bearer ${signJwt({ sub: 'x' }, SECRET, -10)}`)
        .expect(401));
  });
});
