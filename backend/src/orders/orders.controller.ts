import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user.interface';
import { CreateOrderDto } from './dto/create-order.dto'; // Import DTO tạo đơn hàng
import { OrderStatus } from './entities/order.entity';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Task 6: Tạo đơn hàng mới từ giỏ hàng (POST /orders) */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user.id, createOrderDto);
  }

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

  /** Task 10.1: Chuyển trạng thái đơn hàng (Order State Machine) */
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    id: number,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateOrderStatus(user.id, id, status);
  }
}