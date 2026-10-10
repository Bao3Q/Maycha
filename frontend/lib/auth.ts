/**
 * Lưu / đọc JWT ở trình duyệt.
 *
 * Task 7 (đăng nhập) chỉ cần gọi `setToken(accessToken)` sau khi
 * POST /auth/login thành công – các trang Đơn hàng sẽ tự dùng token này.
 */
export const TOKEN_KEY = 'accessToken';

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
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // bỏ qua
  }
}
