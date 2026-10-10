import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrderResponseDto, toOrderResponse } from './dto/order-response.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  /** GET /orders/me – lịch sử đơn của user đang đăng nhập (mới nhất trước). */
  findMyOrders(userId: string): OrderResponseDto[] {
    return this.ordersRepository.findByUserId(userId).map(toOrderResponse);
  }

  /** POST /orders – Tạo đơn hàng mới với trạng thái PENDING (Task 6) */
  createOrder(userId: string, createOrderDto: CreateOrderDto): OrderResponseDto {
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      throw new BadRequestException('Giỏ hàng không được để trống');
    }

    const orderId = this.ordersRepository.nextId();
    const now = new Date();

    // Tính tổng tiền dựa trên các item trong giỏ
    let total = 0;
    const items = createOrderDto.items.map((itemDto) => {
      const lineTotal = itemDto.unitPrice * itemDto.qty;
      total += lineTotal;

      return {
        id: this.ordersRepository.nextItemIdValue(),
        orderId,
        productId: itemDto.productId,
        productName: itemDto.productName,
        size: itemDto.size,
        toppings: itemDto.toppings || [],
        qty: itemDto.qty,
        unitPrice: itemDto.unitPrice,
        lineTotal,
      };
    });

    const newOrder = {
      id: orderId,
      userId,
      status: OrderStatus.PENDING, // Trạng thái ban đầu theo yêu cầu Task 6
      total,
      createdAt: now,
      updatedAt: now,
      items,
    };

    const savedOrder = this.ordersRepository.save(newOrder);
    return toOrderResponse(savedOrder);
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