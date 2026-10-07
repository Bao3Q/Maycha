import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user.interface';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Lịch sử đơn hàng của user đang đăng nhập. Phải khai báo trước ':id'. */
  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.ordersService.findMyOrders(user.id);
  }

  /** Chi tiết đơn cho màn hình xác nhận (mã đơn, trạng thái, món, tổng). */
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: number,
  ) {
    return this.ordersService.findMyOrder(user.id, id);
  }
}
