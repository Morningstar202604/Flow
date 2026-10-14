import { Injectable, Inject, Logger, BadRequestException, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { and, eq, sql } from 'drizzle-orm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { users, cartItems } from '../../database/schema';
import type { AuthResponse, User, RegisterRequest, LoginRequest } from '../../../shared/api.interface';

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

    // 卖家注册门禁：需携带与 SELLER_REGISTRATION_CODE 一致的邀请码；
    // 未配置该环境变量时禁止卖家自助注册（由管理员/种子数据开通）。
    let role: 'buyer' | 'seller' = 'buyer';
    if (dto.role === 'seller') {
      const requiredCode = process.env.SELLER_REGISTRATION_CODE;
      if (!requiredCode) {
        throw new ForbiddenException(
          '卖家自助注册未开放：请联系管理员开通账号',
        );
      }
      if (!dto.sellerCode || dto.sellerCode !== requiredCode) {
        throw new ForbiddenException('卖家注册邀请码错误');
      }
      role = 'seller';
    }

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
        points: users.points,
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
        points: users.points,
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

  /**
   * 登录后把游客购物车并入账号购物车（同商品同规格数量相加；保留 variantId）。
   * 采用与 CartService.addItem 一致的手动合并：cart_items 上没有可用的唯一约束
   *（variant_id 可空，NULL 不会被唯一索引去重），ON CONFLICT 在此不可用。
   */
  async mergeGuestCart(userId: string, sessionId: string): Promise<void> {
    if (!sessionId) return;

    await this.db.transaction(async (tx) => {
      const guestItems = await tx
        .select({
          productId: cartItems.productId,
          variantId: cartItems.variantId,
          quantity: cartItems.quantity,
        })
        .from(cartItems)
        .where(eq(cartItems.sessionId, sessionId));

      if (guestItems.length === 0) return;

      const now = new Date();
      for (const item of guestItems) {
        const existing = await tx
          .select({ id: cartItems.id, quantity: cartItems.quantity })
          .from(cartItems)
          .where(and(
            eq(cartItems.userId, userId),
            eq(cartItems.productId, item.productId),
            item.variantId
              ? eq(cartItems.variantId, item.variantId)
              : sql`${cartItems.variantId} IS NULL`,
          ));

        if (existing.length > 0) {
          await tx
            .update(cartItems)
            .set({ quantity: existing[0].quantity + item.quantity, updatedAt: now })
            .where(eq(cartItems.id, existing[0].id));
        } else {
          await tx.insert(cartItems).values({
            userId,
            sessionId: userId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          });
        }
      }

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
        points: users.points,
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
    points?: number;
  }): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as 'buyer' | 'seller' | 'admin',
      points: row.points ?? 0,
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
