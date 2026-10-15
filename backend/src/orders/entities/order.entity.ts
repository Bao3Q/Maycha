import { BadRequestException } from '@nestjs/common';

/**
 * Trạng thái đơn hàng (xem Mục 9.1 – Order State Machine trong đề bài).
 * PENDING → PAID → PREPARING → READY → COMPLETED
 * Nhánh ngoại lệ: PAYMENT_FAILED, CANCELLED.
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Bảng ánh xạ chuyển trạng thái hợp lệ theo Mục 9.1 (Sơ đồ máy trạng thái đơn hàng).
 */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [], // Trạng thái kết thúc
  [OrderStatus.CANCELLED]: [], // Trạng thái kết thúc
};

/**
 * Hàm kiểm tra và chặn chuyển trạng thái không hợp lệ theo Mục 9.1.
 * Ném BadRequestException nếu chuyển đổi vi phạm sơ đồ máy trạng thái.
 */
export function assertTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): void {
  const allowed = VALID_ORDER_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new BadRequestException(
      `Không thể chuyển trạng thái đơn hàng từ ${currentStatus} sang ${nextStatus}`,
    );
  }
}

export type ProductSize = 'S' | 'M' | 'L';

/** OrderItem(id, orderId, productId, size, qty, lineTotal) – Mục 12.2 */
export interface OrderItem {
  id: number;
  orderId: number;
  productId: string;
  productName: string;
  size: ProductSize;
  toppings: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/** Order(id, userId, status, total, createdAt) – Mục 12.2 */
export interface Order {
  id: number;
  userId: string;
  status: OrderStatus;
  subtotal?: number;
  discountAmount?: number;
  voucherCode?: string;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
}

