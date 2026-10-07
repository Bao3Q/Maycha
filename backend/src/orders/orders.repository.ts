import { Injectable } from '@nestjs/common';
import { Order } from './entities/order.entity';

/**
 * Kho lưu đơn hàng.
 *
 * Hiện dùng bộ nhớ trong (giống ProductsService) vì dự án chưa tích hợp
 * Prisma/PostgreSQL. Khi có Prisma, chỉ cần thay phần thân các hàm dưới đây
 * bằng truy vấn `prisma.order.*` – OrdersService và controller giữ nguyên.
 *
 * Task 6 (POST /orders) và Task 8 (POST /payments) dùng `save()` để
 * tạo / cập nhật đơn; Task 9 dùng `findByUserId()` và `findById()`.
 */
@Injectable()
export class OrdersRepository {
  private readonly orders = new Map<number, Order>();
  private nextOrderId = 1001;
  private nextItemId = 1;

  /** Cấp mã đơn mới (hiển thị dạng #1001, #1002, ...). */
  nextId(): number {
    return this.nextOrderId++;
  }

  /** Cấp id cho dòng sản phẩm trong đơn. */
  nextItemIdValue(): number {
    return this.nextItemId++;
  }

  save(order: Order): Order {
    const copy = this.clone(order);
    this.orders.set(copy.id, copy);
    if (copy.id >= this.nextOrderId) this.nextOrderId = copy.id + 1;
    for (const item of copy.items) {
      if (item.id >= this.nextItemId) this.nextItemId = item.id + 1;
    }
    return this.clone(copy);
  }

  findById(id: number): Order | undefined {
    const order = this.orders.get(id);
    return order ? this.clone(order) : undefined;
  }

  /** Lấy toàn bộ đơn của một user, mới nhất trước. */
  findByUserId(userId: string): Order[] {
    return [...this.orders.values()]
      .filter((o) => o.userId === userId)
      .sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
      )
      .map((o) => this.clone(o));
  }

  /** Dùng trong test. */
  clear(): void {
    this.orders.clear();
    this.nextOrderId = 1001;
    this.nextItemId = 1;
  }

  private clone(order: Order): Order {
    return {
      ...order,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
      items: order.items.map((i) => ({ ...i, toppings: [...i.toppings] })),
    };
  }
}
