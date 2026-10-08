import { Injectable, Inject, Logger, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, sql } from 'drizzle-orm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { users, cartItems } from '@server/database/schema';
import type { AuthResponse, User, RegisterRequest, LoginRequest } from '@shared/api.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterRequest): Promise<AuthResponse> {
    const email = dto.email?.trim().toLowerCase() ?? '';
    const name = dto.name?.trim() ?? '';

    if (!email || !dto.password || !name) {
      throw new BadRequestException('邮箱、密码、姓名不能为空');
    }

    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    if (existing.length > 0) {
      throw new ConflictException('该邮箱已注册');
    }

    if (dto.password.length < 8) {
      throw new BadRequestException('密码长度至少 8 位');
    }

    if (!/[A-Za-z]/.test(dto.password) || !/[0-9]/.test(dto.password)) {
      throw new BadRequestException('密码必须同时包含字母和数字');
    }

    const role = dto.role === 'seller' ? 'seller' : 'buyer';

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const inserted = await this.db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        role,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      });

    const user = this.mapUser(inserted[0]);
    const token = this.generateToken(user);

    return { token, user };
  }

  async login(dto: LoginRequest): Promise<AuthResponse> {
    const email = dto.email?.trim().toLowerCase() ?? '';

    if (!email || !dto.password) {
      throw new BadRequestException('邮箱和密码不能为空');
    }

    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        passwordHash: users.passwordHash,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.email, email));

    if (rows.length === 0) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const row = rows[0];
    const valid = await bcrypt.compare(dto.password, row.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const user = this.mapUser(row);
    const token = this.generateToken(user);

    return { token, user };
  }

  async mergeGuestCart(userId: string, sessionId: string): Promise<void> {
    if (!sessionId) return;

    await this.db.transaction(async (tx) => {
      const guestItems = await tx
        .select({ productId: cartItems.productId, quantity: cartItems.quantity })
        .from(cartItems)
        .where(eq(cartItems.sessionId, sessionId));

      if (guestItems.length === 0) return;

      const values = guestItems.map((item) => ({
        userId,
        productId: item.productId,
        quantity: item.quantity,
        sessionId: '',
      }));

      await tx
        .insert(cartItems)
        .values(values)
        .onConflictDoUpdate({
          target: [cartItems.userId, cartItems.productId],
          set: { quantity: sql`${cartItems.quantity} + ${sql.raw('excluded.quantity')}` },
        });

      await tx.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
    });
  }

  async getUserById(id: string): Promise<User | null> {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id));

    if (rows.length === 0) return null;
    return this.mapUser(rows[0]);
  }

  private mapUser(row: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date;
  }): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as 'buyer' | 'seller' | 'admin',
      createdAt: row.createdAt.toISOString(),
    };
  }

  generateToken(user: User): string {
    return this.jwtService.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }
}
