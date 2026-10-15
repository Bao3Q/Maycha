import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrderResponseDto, toOrderResponse } from './dto/order-response.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus, assertTransition } from './entities/order.entity';
import { ProductsService } from '../products/products.service';

/** Danh sách mã giảm giá hợp lệ (Task 10.4) */
export const VALID_VOUCHERS: Record<string, (subtotal: number) => number> = {
  MAYCHA10: (subtotal) => Math.round(subtotal * 0.1), // Giảm 10%
  BREWLITE20: (subtotal) => Math.min(20000, subtotal), // Giảm 20.000đ
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    @Optional() private readonly productsService?: ProductsService,
  ) {}

  /** GET /orders/me – lịch sử đơn của user đang đăng nhập (mới nhất trước). */
  findMyOrders(userId: string): OrderResponseDto[] {
    return this.ordersRepository.findByUserId(userId).map(toOrderResponse);
  }

  /** POST /orders – Tạo đơn hàng mới với trạng thái PENDING (Task 6 & Task 10) */
  createOrder(userId: string, createOrderDto: CreateOrderDto): OrderResponseDto {
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      throw new BadRequestException('Giỏ hàng không được để trống');
    }

    for (const item of createOrderDto.items) {
      if (
        !item.productId ||
        !Number.isSafeInteger(item.qty) ||
        item.qty <= 0 ||
        !Number.isSafeInteger(item.unitPrice) ||
        item.unitPrice < 0
      ) {
        throw new BadRequestException('Thông tin sản phẩm trong đơn không hợp lệ');
      }
    }

    const subtotal = createOrderDto.items.reduce((sum, item) => {
      const lineTotal = item.unitPrice * item.qty;
      const nextSubtotal = sum + lineTotal;
      if (
        !Number.isSafeInteger(lineTotal) ||
        !Number.isSafeInteger(nextSubtotal)
      ) {
        throw new BadRequestException('Tổng tiền đơn hàng không hợp lệ');
      }
      return nextSubtotal;
    }, 0);

    // Validate the voucher before reserving any inventory.
    let discountAmount = 0;
    let voucherCode: string | undefined;
    if (createOrderDto.voucherCode) {
      const code = createOrderDto.voucherCode.trim().toUpperCase();
      const calculateDiscount = Object.hasOwn(VALID_VOUCHERS, code)
        ? VALID_VOUCHERS[code]
        : undefined;
      if (!calculateDiscount) {
        throw new BadRequestException(`Mã giảm giá "${code}" không hợp lệ`);
      }
      discountAmount = calculateDiscount(subtotal);
      voucherCode = code;
    }

    const total = Math.max(0, subtotal - discountAmount);

    const createAndSaveOrder = (): OrderResponseDto => {
      const orderId = this.ordersRepository.nextId();
      const now = new Date();
      const items = createOrderDto.items.map((itemDto) => ({
        id: this.ordersRepository.nextItemIdValue(),
        orderId,
        productId: itemDto.productId,
        productName: itemDto.productName,
        size: itemDto.size,
        toppings: itemDto.toppings ? [...itemDto.toppings] : [],
        qty: itemDto.qty,
        unitPrice: itemDto.unitPrice,
        lineTotal: itemDto.unitPrice * itemDto.qty,
      }));

      const newOrder: Order = {
        id: orderId,
        userId,
        status: OrderStatus.PENDING,
        subtotal,
        discountAmount,
        voucherCode,
        total,
        createdAt: now,
        updatedAt: now,
        items,
      };

      return toOrderResponse(this.ordersRepository.save(newOrder));
    };

    if (!this.productsService) {
      return createAndSaveOrder();
    }

    return this.productsService.withStockReservation(
      createOrderDto.items.map(({ productId, qty }) => ({ productId, qty })),
      createAndSaveOrder,
    );
  }

  /**
   * PATCH /orders/:id/status – Chuyển trạng thái đơn hàng (Order State Machine - Task 10.1).
   * Kiểm tra bằng assertTransition; nếu hủy đơn (CANCELLED) thì hoàn tồn kho.
   */
  updateOrderStatus(
    userId: string,
    orderId: number,
    nextStatus: OrderStatus,
  ): OrderResponseDto {
    const order = this.ordersRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }

    // Chặn chuyển trạng thái sai quy tắc theo Task 10.1
    assertTransition(order.status, nextStatus);

    const saveStatus = (): Order => {
      order.status = nextStatus;
      order.updatedAt = new Date();
      return this.ordersRepository.save(order);
    };

    if (
      nextStatus === OrderStatus.CANCELLED &&
      this.productsService
    ) {
      return toOrderResponse(
        this.productsService.withStockRestoration(
          order.items.map(({ productId, qty }) => ({ productId, qty })),
          saveStatus,
        ),
      );
    }

    return toOrderResponse(saveStatus());
  }

  /**
   * GET /orders/:id – chi tiết một đơn cho màn hình xác nhận.
   * Đơn của người khác được xử lý như không tồn tại (404) để không lộ thông tin.
   */
  findMyOrder(userId: string, orderId: number): OrderResponseDto {
    const order = this.ordersRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    return toOrderResponse(order);
  }
}