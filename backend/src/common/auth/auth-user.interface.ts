/** Thông tin user lấy từ JWT, được JwtAuthGuard gắn vào `request.user`. */
export interface AuthUser {
  id: string;
  email?: string;
}

/** Payload JWT mà POST /auth/login (Task 7) cần phát ra. */
export interface JwtPayload {
  sub: string | number;
  email?: string;
  iat?: number;
  exp?: number;
}
