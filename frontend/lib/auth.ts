/**
 * Lưu / đọc JWT ở trình duyệt.
 *
 * Trang /login gọi `setToken(accessToken)` sau khi POST /auth/login thành
 * công – các trang Menu / Đơn hàng tự dùng token này.
 */
export const TOKEN_KEY = 'accessToken';

/** Báo cho các component đang hiển thị trạng thái đăng nhập (cùng tab). */
const AUTH_EVENT = 'maycha-auth-change';

function notify(): void {
  try {
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {
    // bỏ qua
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư…) – bỏ qua.
  }
  notify();
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // bỏ qua
  }
  notify();
}

/** Dùng với useSyncExternalStore: lắng nghe đăng nhập / đăng xuất (kể cả tab khác). */
export function subscribeToken(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === TOKEN_KEY) listener();
  };
  window.addEventListener(AUTH_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(AUTH_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Chỉ cho phép chuyển hướng nội bộ (tránh ?next=https://trang-la.com). */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
