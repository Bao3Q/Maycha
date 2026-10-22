import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrderResponseDto, toOrderResponse } from './dto/order-response.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus, assertTransition } from './entities/order.entity';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../common/prisma.service';

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
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

  /** GET /orders/me – lịch sử đơn của user đang đăng nhập (mới nhất trước). */
  async findMyOrders(userId: string): Promise<OrderResponseDto[]> {
    return (await this.ordersRepository.findByUserId(userId)).map(toOrderResponse);
  }

  /** POST /orders – Tạo đơn hàng mới với trạng thái PENDING (Task 6 & Task 10) */
  async createOrder(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
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

    if (this.prisma) {
      const quantities = this.aggregateQuantities(createOrderDto);
      const createdOrderId = await this.prisma.$transaction(async (tx) => {
        for (const [productId, qty] of quantities) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) {
            throw new NotFoundException(
              `Sản phẩm với ID ${productId} không tồn tại`,
            );
          }
          if (product.stock < qty) {
            throw new BadRequestException(
              `Sản phẩm "${product.name}" không đủ số lượng tồn kho (còn ${product.stock}, yêu cầu ${qty})`,
            );
          }
          const updated = await tx.product.updateMany({
            where: { id: productId, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          });
          if (updated.count !== 1) {
            throw new ConflictException(
              `Tồn kho sản phẩm "${product.name}" vừa được thay đổi, vui lòng thử lại`,
            );
          }
        }

        const created = await tx.order.create({
          data: {
            userId,
            status: OrderStatus.PENDING,
            subtotal,
            discountAmount,
            voucherCode,
            total,
            items: {
              create: createOrderDto.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                size: item.size,
                toppings: item.toppings ? [...item.toppings] : [],
                qty: item.qty,
                unitPrice: item.unitPrice,
                lineTotal: item.unitPrice * item.qty,
              })),
            },
          },
        });
        return created.id;
      });
      const saved = await this.ordersRepository.findById(createdOrderId);
      if (!saved) {
        throw new NotFoundException('Không tìm thấy đơn hàng vừa tạo');
      }
      return toOrderResponse(saved);
    }

    const createAndSaveOrder = async (): Promise<OrderResponseDto> => {
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

      return toOrderResponse(await this.ordersRepository.save(newOrder));
    };

    if (!this.productsService) {
      return await createAndSaveOrder();
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
  async updateOrderStatus(
    userId: string,
    orderId: number,
    nextStatus: OrderStatus,
  ): Promise<OrderResponseDto> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }

    // Chặn chuyển trạng thái sai quy tắc theo Task 10.1
    assertTransition(order.status, nextStatus);

    if (this.prisma) {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });
        if (!current || current.userId !== userId) {
          throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
        }
        assertTransition(current.status as OrderStatus, nextStatus);

        if (nextStatus === OrderStatus.CANCELLED) {
          const quantities = new Map<string, number>();
          for (const item of current.items) {
            quantities.set(
              item.productId,
              (quantities.get(item.productId) ?? 0) + item.qty,
            );
          }
          for (const [productId, qty] of quantities) {
            await tx.product.update({
              where: { id: productId },
              data: { stock: { increment: qty } },
            });
          }
        }

        const updated = await tx.order.updateMany({
          where: { id: orderId, status: current.status },
          data: { status: nextStatus },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'Trạng thái đơn hàng vừa được thay đổi, vui lòng thử lại',
          );
        }
      });
      const updated = await this.ordersRepository.findById(orderId);
      if (!updated) {
        throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
      }
      return toOrderResponse(updated);
    }

    const saveStatus = async (): Promise<Order> => {
      order.status = nextStatus;
      order.updatedAt = new Date();
      return this.ordersRepository.save(order);
    };

    if (
      nextStatus === OrderStatus.CANCELLED &&
      this.productsService
    ) {
      return toOrderResponse(
        await this.productsService.withStockRestoration(
          order.items.map(({ productId, qty }) => ({ productId, qty })),
          saveStatus,
        ),
      );
    }

    return toOrderResponse(await saveStatus());
  }

  /**
   * GET /orders/:id – chi tiết một đơn cho màn hình xác nhận.
   * Đơn của người khác được xử lý như không tồn tại (404) để không lộ thông tin.
   */
  async findMyOrder(userId: string, orderId: number): Promise<OrderResponseDto> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    return toOrderResponse(order);
  }

  private aggregateQuantities(
    createOrderDto: CreateOrderDto,
  ): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const { productId, qty } of createOrderDto.items) {
      const totalQty = (quantities.get(productId) ?? 0) + qty;
      if (!Number.isSafeInteger(totalQty)) {
        throw new BadRequestException('Tổng số lượng sản phẩm không hợp lệ');
      }
      quantities.set(productId, totalQty);
    }
    return quantities;
  }
}