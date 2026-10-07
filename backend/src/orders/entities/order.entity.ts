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
  total: number;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
}
