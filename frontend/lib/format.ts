import type { OrderItem, OrderStatus } from './api';

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function formatVnd(amount: number): string {
  return vnd.format(amount);
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function describeItem(item: OrderItem): string {
  const parts = [`Size ${item.size}`];
  if (item.toppings.length > 0) parts.push(item.toppings.join(', '));
  return parts.join(' · ');
}

export interface StatusMeta {
  label: string;
  /** Lớp Tailwind cho huy hiệu trạng thái. */
  badge: string;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDING: {
    label: 'Chờ thanh toán',
    badge: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  },
  PAID: {
    label: 'Đã thanh toán',
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  },
  PAYMENT_FAILED: {
    label: 'Thanh toán thất bại',
    badge: 'bg-red-100 text-red-800 ring-red-600/20',
  },
  PREPARING: {
    label: 'Đang pha chế',
    badge: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  },
  READY: {
    label: 'Sẵn sàng nhận',
    badge: 'bg-indigo-100 text-indigo-800 ring-indigo-600/20',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    badge: 'bg-stone-200 text-stone-800 ring-stone-600/20',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badge: 'bg-stone-100 text-stone-500 ring-stone-500/20',
  },
};
