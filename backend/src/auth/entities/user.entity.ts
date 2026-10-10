/** User(id, email, passwordHash, loyaltyPoints) – Mục 12.2 đề bài. */
export interface User {
  id: string;
  email: string;
  /** Mật khẩu đã băm bằng bcrypt – KHÔNG bao giờ trả ra ngoài API. */
  passwordHash: string;
  loyaltyPoints: number;
  createdAt: Date;
}

/** Thông tin user an toàn để trả về cho client (không có passwordHash). */
export interface PublicUser {
  id: string;
  email: string;
  loyaltyPoints: number;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    loyaltyPoints: user.loyaltyPoints,
  };
}
