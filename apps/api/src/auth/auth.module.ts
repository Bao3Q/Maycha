import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';

/**
 * Task 7 – Đăng ký / Đăng nhập (JWT).
 *
 * Route cần đăng nhập (vd. POST /orders của Task 6) chỉ cần gắn
 * `@UseGuards(JwtAuthGuard)` – guard export từ đây, hoặc import trực tiếp
 * từ `common/auth/jwt-auth.guard` như OrdersController đang làm.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, UsersRepository, JwtAuthGuard],
  exports: [UsersRepository, JwtAuthGuard],
})
export class AuthModule {}
