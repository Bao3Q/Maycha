export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CANCELLED = 'CANCELLED',
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: string;
  productName: string;
  size: string;
  toppings: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  userId: string;
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
}