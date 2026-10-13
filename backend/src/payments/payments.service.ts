import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersRepository } from '../orders/orders.repository';
import { OrderStatus } from '../orders/entities/order.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  processPayment(userId: string, createPaymentDto: CreatePaymentDto) {
    const order = this.ordersRepository.findById(createPaymentDto.orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    
    if (order.userId !== userId) {
      throw new BadRequestException('Not your order');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYMENT_FAILED) {
     
      if (order.status === OrderStatus.PAID) {
        return { success: true, orderId: order.id, status: order.status, message: 'Already paid' };
      }
      throw new BadRequestException('Order cannot be paid in current status');
    }

    
    if (createPaymentDto.method === 'FAIL') {
      order.status = OrderStatus.PAYMENT_FAILED;
      order.updatedAt = new Date();
      this.ordersRepository.save(order);
      return { success: false, orderId: order.id, status: order.status };
    }

    order.status = OrderStatus.PAID;
    order.updatedAt = new Date();
    this.ordersRepository.save(order);

    return { success: true, orderId: order.id, status: order.status };
  }
}
