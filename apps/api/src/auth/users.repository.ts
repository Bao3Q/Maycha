import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { User, UserRole } from './entities/user.entity';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class UsersRepository {
  private readonly users = new Map<string, User>();
  private readonly emailIndex = new Map<string, string>();

  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

  async create(
    email: string,
    passwordHash: string,
    role: UserRole = 'CUSTOMER',
  ): Promise<User | undefined> {
    const key = email.toLowerCase();
    if (this.prisma) {
      try {
        return await this.prisma.user.create({
          data: { email: key, passwordHash, role },
        });
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          return undefined;
        }
        throw error;
      }
    }
    if (this.emailIndex.has(key)) return undefined;

    const user: User = {
      id: randomUUID(),
      email: key,
      passwordHash,
      role,
      loyaltyPoints: 0,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.emailIndex.set(key, user.id);
    return { ...user };
  }

  async findByEmail(email: string): Promise<User | undefined> {
    if (this.prisma) {
      return (await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      })) ?? undefined;
    }
    const id = this.emailIndex.get(email.toLowerCase());
    const user = id ? this.users.get(id) : undefined;
    return user ? { ...user } : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    if (this.prisma) {
      return (await this.prisma.user.findUnique({ where: { id } })) ?? undefined;
    }
    const user = this.users.get(id);
    return user ? { ...user } : undefined;
  }

  /** Dùng trong test. */
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }
}
