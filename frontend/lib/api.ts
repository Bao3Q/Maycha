import { clearToken, getToken } from './auth';

/** Trình duyệt gọi thẳng backend (xem NEXT_PUBLIC_API_URL trong README). */
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
).replace(/\/+$/, '');

/** Bật nút "Dùng tài khoản demo" khi chưa có trang đăng nhập (Task 7). */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true';

// ---- Kiểu dữ liệu: khớp với OrderResponseDto ở backend ----

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItem {
  id: number;
  productId: string;
  productName: string;
  size: 'S' | 'M' | 'L';
  toppings: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  /** Mã đơn hiển thị, ví dụ "#1042". */
  code: string;
  status: OrderStatus;
  subtotal?: number;
  discountAmount?: number;
  voucherCode?: string;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

// ---- Kết quả gọi API: không throw, để trang chỉ cần switch theo `kind` ----

export type ApiErrorKind =
  | 'unauthenticated'
  | 'not-found'
  | 'bad-request'
  | 'network'
  | 'server';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: ApiErrorKind; message: string };

async function readMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message.join(', ') : body.message;
  } catch {
    return undefined;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const { auth = true, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set('Accept', 'application/json');

  if (auth) {
    const token = getToken();
    if (!token) {
      return {
        ok: false,
        kind: 'unauthenticated',
        message: 'Bạn chưa đăng nhập.',
      };
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers,
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false,
      kind: 'network',
      message: `Không kết nối được tới máy chủ (${API_URL}).`,
    };
  }

  if (res.ok) {
    return { ok: true, data: (await res.json()) as T };
  }

  const message = await readMessage(res);
  switch (res.status) {
    case 401:
      if (auth) clearToken();
      return {
        ok: false,
        kind: 'unauthenticated',
        message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
      };
    case 404:
      return {
        ok: false,
        kind: 'not-found',
        message: message ?? 'Không tìm thấy dữ liệu.',
      };
    case 400:
      return {
        ok: false,
        kind: 'bad-request',
        message: message ?? 'Yêu cầu không hợp lệ.',
      };
    default:
      return {
        ok: false,
        kind: 'server',
        message: message ?? `Máy chủ lỗi (HTTP ${res.status}).`,
      };
  }
}

/** GET /orders/me – lịch sử đơn, mới nhất trước. */
export function fetchMyOrders(): Promise<ApiResult<Order[]>> {
  return request<Order[]>('/orders/me');
}

/** GET /orders/:id – dữ liệu màn hình xác nhận. */
export function fetchOrder(id: string): Promise<ApiResult<Order>> {
  return request<Order>(`/orders/${encodeURIComponent(id)}`);
}

/** POST /dev/demo-session – chỉ hoạt động khi backend bật ENABLE_DEMO_SEED. */
export function createDemoSession(): Promise<
  ApiResult<{ accessToken: string; orders: Order[] }>
> {
  return request('/dev/demo-session', { method: 'POST', auth: false });
}

/** PATCH /orders/:id/status – chuyển trạng thái đơn (Task 10.1 Order State Machine). */
export function updateOrderStatus(
  id: number | string,
  status: OrderStatus,
): Promise<ApiResult<Order>> {
  return request<Order>(`/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

/** GET /payments/loyalty – lấy điểm thưởng tích lũy của user (Task 10.4). */
export function fetchLoyaltyPoints(): Promise<
  ApiResult<{ userId: string; loyaltyPoints: number }>
> {
  return request<{ userId: string; loyaltyPoints: number }>('/payments/loyalty');
}
