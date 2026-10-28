import { clearToken, getToken } from './auth';

/** Use a same-origin Next.js proxy by default; set this to call an API directly. */
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
export const API_URL = configuredApiUrl
  ? configuredApiUrl.replace(/\/+$/, '')
  : undefined;

/** Bật nút "Dùng tài khoản demo" (chỉ để demo, tắt khi nộp bản cuối). */
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
  | 'conflict'
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
  headers.set('ngrok-skip-browser-warning', '1');

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
    const requestUrl = API_URL ? `${API_URL}${path}` : `/api${path}`;
    res = await fetch(requestUrl, {
      ...rest,
      headers,
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false,
      kind: 'network',
      message: `Không kết nối được tới máy chủ (${API_URL ?? 'API proxy'}).`,
    };
  }

  if (res.ok) {
    return { ok: true, data: (await res.json()) as T };
  }

  const message = await readMessage(res);
  switch (res.status) {
    case 401:
      if (auth) {
        clearToken();
        return {
          ok: false,
          kind: 'unauthenticated',
          message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
        };
      }
      // Route không cần token (vd. /auth/login) → dùng thông báo của backend.
      return {
        ok: false,
        kind: 'unauthenticated',
        message: message ?? 'Không xác thực được.',
      };
    case 404:
      return {
        ok: false,
        kind: 'not-found',
        message: message ?? 'Không tìm thấy dữ liệu.',
      };
    case 409:
      return {
        ok: false,
        kind: 'conflict',
        message: message ?? 'Dữ liệu bị trùng.',
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

/** PATCH /orders/:id/status – chuyển trạng thái đơn hàng. */
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

/** GET /payments/loyalty – lấy điểm thưởng tích lũy của user. */
export function fetchLoyaltyPoints(): Promise<
  ApiResult<{ userId: string; loyaltyPoints: number }>
> {
  return request<{ userId: string; loyaltyPoints: number }>('/payments/loyalty');
}

// ---- Đăng ký / đăng nhập ----

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: { id: string; email: string; loyaltyPoints: number };
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** POST /auth/register */
export function register(
  email: string,
  password: string,
): Promise<ApiResult<LoginResponse['user']>> {
  return request('/auth/register', {
    ...jsonBody({ email, password }),
    auth: false,
  });
}

/** POST /auth/login → trả JWT. */
export function login(
  email: string,
  password: string,
): Promise<ApiResult<LoginResponse>> {
  return request('/auth/login', { ...jsonBody({ email, password }), auth: false });
}

// ---- Đặt đơn & thanh toán ----

export interface CreateOrderItem {
  productId: string;
  productName: string;
  size: 'S' | 'M' | 'L';
  toppings: string[];
  qty: number;
  unitPrice: number;
}

/** POST /orders – tạo đơn PENDING từ giỏ hàng. */
export function createOrder(
  items: CreateOrderItem[],
  voucherCode?: string,
): Promise<ApiResult<Order>> {
  return request<Order>('/orders', jsonBody({ items, voucherCode }));
}

/** WALLET / CARD / MOMO / VNPAY: thành công; FAIL: giả lập cổng thanh toán lỗi (demo). */
export type PaymentMethod = 'WALLET' | 'CARD' | 'MOMO' | 'VNPAY' | 'SEPAY' | 'FAIL';
type MockPaymentMethod = Exclude<PaymentMethod, 'SEPAY'>;

export interface PaymentResponse {
  success: boolean;
  orderId: number;
  status: OrderStatus;
  message?: string;
  earnedLoyaltyPoints?: number;
  totalLoyaltyPoints?: number;
  isIdempotent?: boolean;
}

/** POST /payments – thanh toán mock. */
export function payOrder(
  orderId: number,
  method: MockPaymentMethod,
  idempotencyKey: string,
): Promise<ApiResult<PaymentResponse>> {
  return request<PaymentResponse>(
    '/payments',
    jsonBody({ orderId, method, idempotencyKey }),
  );
}

export interface SePayCheckoutResponse {
  orderId: number;
  amount: number;
  transferDescription: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  qrUrl: string;
  status: 'PENDING';
}

/** POST /payments/sepay/checkout – tạo QR thanh toán và phiên chờ webhook. */
export function createSePayCheckout(
  orderId: number,
): Promise<ApiResult<SePayCheckoutResponse>> {
  return request<SePayCheckoutResponse>(
    '/payments/sepay/checkout',
    jsonBody({ orderId }),
  );
}
