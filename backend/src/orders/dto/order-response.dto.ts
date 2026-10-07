import { Order, OrderStatus, ProductSize } from '../entities/order.entity';

export interface OrderItemResponseDto {
  id: number;
  productId: string;
  productName: string;
  size: ProductSize;
  toppings: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/** Dữ liệu trả cho màn hình Xác nhận đơn và Lịch sử đơn. */
export interface OrderResponseDto {
  id: number;
  /** Mã đơn hiển thị cho khách, ví dụ "#1042". */
  code: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItemResponseDto[];
}

export function toOrderResponse(order: Order): OrderResponseDto {
  return {
    id: order.id,
    code: `#${order.id}`,
    status: order.status,
    total: order.total,
    itemCount: order.items.reduce((sum, i) => sum + i.qty, 0),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      size: i.size,
      toppings: [...i.toppings],
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
  };
}
