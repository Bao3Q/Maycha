import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';

/**
 * Kho lưu tài khoản.
 *
 * Giống OrdersRepository: hiện dùng bộ nhớ trong vì dự án chưa tích hợp
 * Prisma/PostgreSQL. Khi có Prisma, chỉ cần thay phần thân các hàm dưới đây
 * bằng truy vấn `prisma.user.*` – AuthService và controller giữ nguyên.
 */
@Injectable()
export class UsersRepository {
  private readonly users = new Map<string, User>();
  /** email (đã chuẩn hóa chữ thường) → id, để tra cứu & chặn trùng email. */
  private readonly emailIndex = new Map<string, string>();

  /** Tạo user mới. Trả `undefined` nếu email đã tồn tại. */
  create(email: string, passwordHash: string): User | undefined {
    const key = email.toLowerCase();
    if (this.emailIndex.has(key)) return undefined;

    const user: User = {
      id: randomUUID(),
      email: key,
      passwordHash,
      loyaltyPoints: 0,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.emailIndex.set(key, user.id);
    return { ...user };
  }

  findByEmail(email: string): User | undefined {
    const id = this.emailIndex.get(email.toLowerCase());
    const user = id ? this.users.get(id) : undefined;
    return user ? { ...user } : undefined;
  }

  findById(id: string): User | undefined {
    const user = this.users.get(id);
    return user ? { ...user } : undefined;
  }

  /** Dùng trong test. */
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }
}
