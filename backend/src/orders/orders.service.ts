import { Injectable, NotFoundException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrderResponseDto, toOrderResponse } from './dto/order-response.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  /** GET /orders/me – lịch sử đơn của user đang đăng nhập (mới nhất trước). */
  findMyOrders(userId: string): OrderResponseDto[] {
    return this.ordersRepository.findByUserId(userId).map(toOrderResponse);
  }

  /**
   * GET /orders/:id – chi tiết một đơn cho màn hình xác nhận.
   * Đơn của người khác được xử lý như không tồn tại (404) để không lộ
   * thông tin đơn hàng.
   */
  findMyOrder(userId: string, orderId: number): OrderResponseDto {
    const order = this.ordersRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    return toOrderResponse(order);
  }
}
