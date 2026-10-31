import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { ProductsService } from '../products/products.service';
import { PaymentsService } from '../payments/payments.service';
import {
  OrderStatus,
  assertTransition,
  VALID_ORDER_TRANSITIONS,
} from './entities/order.entity';
import { OrderSize } from './dto/create-order.dto';
import { PaymentMethod } from '../payments/dto/create-payment.dto';

describe('Nghiệp vụ backend nâng cao (BrewLite)', () => {
  let ordersRepo: OrdersRepository;
  let productsService: ProductsService;
  let ordersService: OrdersService;
  let paymentsService: PaymentsService;

  beforeEach(() => {
    ordersRepo = new OrdersRepository();
    productsService = new ProductsService();
    ordersService = new OrdersService(ordersRepo, productsService);
    paymentsService = new PaymentsService(ordersRepo);
  });

  describe('1. Order State Machine (assertTransition)', () => {
    it('cho phép chuyển tiếp hợp lệ theo luồng chính: PENDING -> PAID -> PREPARING -> READY -> COMPLETED', () => {
      expect(() =>
        assertTransition(OrderStatus.PENDING, OrderStatus.PAID),
      ).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.PAID, OrderStatus.PREPARING),
      ).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.PREPARING, OrderStatus.READY),
      ).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.READY, OrderStatus.COMPLETED),
      ).not.toThrow();
    });

    it('cho phép chuyển tiếp ngoại lệ: PAYMENT_FAILED -> PAID, PENDING -> CANCELLED, PAID -> CANCELLED', () => {
      expect(() =>
        assertTransition(OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED),
      ).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PAID),
      ).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED),
      ).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.PENDING, OrderStatus.CANCELLED),
      ).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.PAID, OrderStatus.CANCELLED),
      ).not.toThrow();
    });

    it('chặn chuyển trạng thái từ trạng thái kết thúc (COMPLETED và CANCELLED)', () => {
      expect(VALID_ORDER_TRANSITIONS[OrderStatus.COMPLETED]).toEqual([]);
      expect(VALID_ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);

      expect(() =>
        assertTransition(OrderStatus.COMPLETED, OrderStatus.PENDING),
      ).toThrow(BadRequestException);
      expect(() =>
        assertTransition(OrderStatus.CANCELLED, OrderStatus.PAID),
      ).toThrow(BadRequestException);
      expect(() =>
        assertTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED),
      ).toThrow(BadRequestException);
    });

    it('OrdersService.updateOrderStatus cho phép hủy đơn đang PENDING', async () => {
      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '1',
            productName: 'Hồng Trà Bí Đao',
            size: OrderSize.M,
            qty: 1,
            unitPrice: 35000,
          },
        ],
      });

      const cancelledOrder = await ordersService.updateOrderStatus(
        'u1',
        order.id,
        OrderStatus.CANCELLED,
      );
      expect(cancelledOrder.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('2. Thanh toán Idempotent (Idempotency-Key)', () => {
    it('gửi 2 lần cùng Idempotency-Key chỉ tạo 1 giao dịch và trả cùng kết quả', async () => {
      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '2',
            productName: 'Trà Đào Cam Sả',
            size: OrderSize.L,
            qty: 1,
            unitPrice: 39000,
          },
        ],
      });

      const idempotencyKey = 'payment-key-uuid-12345';

      // Lần gửi 1: Thanh toán thành công
      const payment1 = await paymentsService.processPayment('u1', {
        orderId: order.id,
        method: 'MOMO',
        idempotencyKey,
      });

      expect(payment1.success).toBe(true);
      expect(payment1.status).toBe(OrderStatus.PAID);
      expect(payment1.earnedLoyaltyPoints).toBe(4); // Size L: 49.000đ -> 4 điểm

      // Lần gửi 2: Cùng Idempotency-Key
      const payment2 = await paymentsService.processPayment('u1', {
        orderId: order.id,
        method: 'MOMO',
        idempotencyKey,
      });

      // Kết quả lần 2 phải trả về kết quả đã cache mà không bị nhân đôi điểm
      expect(payment2.success).toBe(true);
      expect(payment2.status).toBe(OrderStatus.PAID);
      expect(payment2.isIdempotent).toBe(true);

      // Điểm tích lũy không bị nhân đôi
      expect(await paymentsService.getLoyaltyPoints('u1')).toBe(4);
    });

    it('từ chối dùng lại key cho một đơn hàng hoặc phương thức khác', async () => {
      const firstOrder = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '2',
            productName: 'Trà Đào Cam Sả',
            size: OrderSize.L,
            qty: 1,
            unitPrice: 39000,
          },
        ],
      });
      const secondOrder = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '3',
            productName: 'Cà Phê Sữa Pha Máy',
            size: OrderSize.M,
            qty: 1,
            unitPrice: 30000,
          },
        ],
      });
      const idempotencyKey = 'payment-key-reused';

      await paymentsService.processPayment('u1', {
        orderId: firstOrder.id,
        method: 'MOMO',
        idempotencyKey,
      });

      await expect(
        paymentsService.processPayment('u1', {
          orderId: secondOrder.id,
          method: 'MOMO',
          idempotencyKey,
        }),
      ).rejects.toThrow(ConflictException);
      expect((await ordersService.findMyOrder('u1', secondOrder.id)).status).toBe(
        OrderStatus.PENDING,
      );
    });

    it('kiểm tra quyền sở hữu đơn trước khi trả kết quả cache theo key', async () => {
      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '2',
            productName: 'Trà Đào Cam Sả',
            size: OrderSize.L,
            qty: 1,
            unitPrice: 39000,
          },
        ],
      });
      const paymentRequest = {
        orderId: order.id,
        method: 'MOMO' as const,
        idempotencyKey: 'user-scoped-payment-key',
      };
      await paymentsService.processPayment('u1', paymentRequest);

      await expect(
        paymentsService.processPayment('u2', paymentRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối phương thức thanh toán không hỗ trợ', async () => {
      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '2',
            productName: 'Trà Đào Cam Sả',
            size: OrderSize.L,
            qty: 1,
            unitPrice: 39000,
          },
        ],
      });

      await expect(
        paymentsService.processPayment('u1', {
          orderId: order.id,
          method: 'UNKNOWN' as PaymentMethod,
        }),
      ).rejects.toThrow(BadRequestException);
      expect((await ordersService.findMyOrder('u1', order.id)).status).toBe(
        OrderStatus.PENDING,
      );
    });
  });

  describe('3. Kiểm soát tồn kho khi đặt đồng thời (Concurrency Control)', () => {
    it('khi nhiều khách đặt cùng lúc, không bao giờ bán vượt quá số lượng tồn kho còn lại', async () => {
      // Giả lập sản phẩm '1' chỉ còn đúng 3 ly trong kho
      productsService.setStockForTest('1', 3);

      // 5 khách cùng tranh mua sản phẩm '1' (mỗi người 1 ly)
      const concurrentOrders = [1, 2, 3, 4, 5].map((clientIndex) => {
        return Promise.resolve().then(() => {
          return ordersService.createOrder(`user-${clientIndex}`, {
            items: [
              {
                productId: '1',
                productName: 'Hồng Trà Bí Đao',
                size: OrderSize.M,
                qty: 1,
                unitPrice: 35000,
              },
            ],
          });
        });
      });

      const results = await Promise.allSettled(concurrentOrders);

      const successfulOrders = results.filter((r) => r.status === 'fulfilled');
      const failedOrders = results.filter((r) => r.status === 'rejected');

      // Đúng 3 người mua được, 2 người bị từ chối
      expect(successfulOrders.length).toBe(3);
      expect(failedOrders.length).toBe(2);

      // Tồn kho cuối cùng phải là 0, không được âm
      const product = productsService.findOne('1');
      expect(product?.stock).toBe(0);
    });

    it('hoàn lại tồn kho khi đơn hàng bị hủy (CANCELLED)', async () => {
      productsService.setStockForTest('3', 10);

      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '3',
            productName: 'Cà Phê Sữa Pha Máy',
            size: OrderSize.M,
            qty: 2,
            unitPrice: 30000,
          },
        ],
      });

      // Tồn kho giảm từ 10 xuống 8
      expect(productsService.findOne('3')?.stock).toBe(8);

      // Khách hủy đơn
      await ordersService.updateOrderStatus('u1', order.id, OrderStatus.CANCELLED);

      // Tồn kho được hoàn trả về 10
      expect(productsService.findOne('3')?.stock).toBe(10);
    });

    it('không hoàn kho nếu cập nhật trạng thái hủy thất bại', async () => {
      productsService.setStockForTest('3', 10);

      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '3',
            productName: 'Cà Phê Sữa Pha Máy',
            size: OrderSize.M,
            qty: 2,
            unitPrice: 30000,
          },
        ],
      });
      jest.spyOn(ordersRepo, 'save').mockImplementation(() => {
        throw new Error('storage failure');
      });

      await expect(
        ordersService.updateOrderStatus('u1', order.id, OrderStatus.CANCELLED),
      ).rejects.toThrow('storage failure');

      expect(productsService.findOne('3')).toMatchObject({
        stock: 8,
      });
      expect((await ordersService.findMyOrder('u1', order.id)).status).toBe(
        OrderStatus.PENDING,
      );
    });

    it('không trừ bất kỳ tồn kho nào nếu một sản phẩm trong giỏ không đủ hàng', async () => {
      productsService.setStockForTest('1', 3);
      productsService.setStockForTest('2', 0);

      await expect(
        ordersService.createOrder('u1', {
          items: [
            {
              productId: '1',
              productName: 'Hồng Trà Bí Đao',
              size: OrderSize.M,
              qty: 2,
              unitPrice: 35000,
            },
            {
              productId: '2',
              productName: 'Trà Đào Cam Sả',
              size: OrderSize.L,
              qty: 1,
              unitPrice: 39000,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(productsService.findOne('1')).toMatchObject({ stock: 3 });
      expect(productsService.findOne('2')).toMatchObject({ stock: 0 });
      expect(await ordersService.findMyOrders('u1')).toHaveLength(0);
    });

    it('khôi phục tồn kho nếu lưu đơn hàng thất bại trong transaction', async () => {
      productsService.setStockForTest('1', 3);
      jest.spyOn(ordersRepo, 'save').mockImplementation(() => {
        throw new Error('storage failure');
      });

      await expect(
        ordersService.createOrder('u1', {
          items: [
            {
              productId: '1',
              productName: 'Hồng Trà Bí Đao',
              size: OrderSize.M,
              qty: 2,
              unitPrice: 35000,
            },
          ],
        }),
      ).rejects.toThrow('storage failure');

      expect(productsService.findOne('1')).toMatchObject({ stock: 3 });
    });

    it('trừ tồn kho nếu còn đủ số lượng', () => {
      productsService.setStockForTest('1', 3);

      expect(productsService.deductStock('1', 1).remainingStock).toBe(2);
      expect(productsService.findOne('1')).toMatchObject({ stock: 2 });
    });
  });

  describe('4. Khuyến mãi (Voucher) và Điểm thưởng (Loyalty Points)', () => {
    it('áp dụng mã MAYCHA10 giảm 10% trên tổng đơn', async () => {
      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '4',
            productName: 'Cappuccino',
            size: OrderSize.M,
            qty: 2,
            unitPrice: 45000, // Subtotal: 90.000đ
          },
        ],
        voucherCode: 'MAYCHA10',
      });

      expect(order.subtotal).toBe(100000);
      expect(order.discountAmount).toBe(10000); // 10% của 100.000đ
      expect(order.total).toBe(90000);
      expect(order.voucherCode).toBe('MAYCHA10');
    });

    it('áp dụng mã BREWLITE20 giảm 20.000đ trên tổng đơn', async () => {
      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '2',
            productName: 'Trà Đào Cam Sả',
            size: OrderSize.L,
            qty: 1,
            unitPrice: 39000,
          },
        ],
        voucherCode: 'BREWLITE20',
      });

      expect(order.subtotal).toBe(49000);
      expect(order.discountAmount).toBe(20000);
      expect(order.total).toBe(29000);
    });

    it('ném lỗi BadRequestException khi nhập mã giảm giá không hợp lệ', async () => {
      const stockBefore = productsService.findOne('1');

      await expect(
        ordersService.createOrder('u1', {
          items: [
            {
              productId: '1',
              productName: 'Hồng Trà Bí Đao',
              size: OrderSize.M,
              qty: 1,
              unitPrice: 35000,
            },
          ],
          voucherCode: 'INVALID_CODE',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(productsService.findOne('1')).toEqual(stockBefore);
    });

    it('tích lũy điểm thưởng loyalty cho khách hàng sau khi thanh toán thành công', async () => {
      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '4',
            productName: 'Cappuccino',
            size: OrderSize.M,
            qty: 2,
            unitPrice: 45000, // 90.000đ
          },
        ],
      });

      expect(await paymentsService.getLoyaltyPoints('u1')).toBe(0);

      // Thanh toán thành công -> Tích lũy 9 điểm (90.000 / 10.000)
      const res = await paymentsService.processPayment('u1', {
        orderId: order.id,
        method: 'VNPAY',
      });

      expect(res.earnedLoyaltyPoints).toBe(10);
      expect(await paymentsService.getLoyaltyPoints('u1')).toBe(10);
    });

    it('tính điểm trên tổng tiền sau khi áp dụng voucher', async () => {
      const order = await ordersService.createOrder('u1', {
        items: [
          {
            productId: '2',
            productName: 'Trà Đào Cam Sả',
            size: OrderSize.L,
            qty: 1,
            unitPrice: 39000,
          },
        ],
        voucherCode: 'BREWLITE20',
      });

      const result = await paymentsService.processPayment('u1', {
        orderId: order.id,
        method: 'VNPAY',
      });

      expect(order.total).toBe(29000);
      expect(result.earnedLoyaltyPoints).toBe(2);
      expect(await paymentsService.getLoyaltyPoints('u1')).toBe(2);
    });
  });
});
