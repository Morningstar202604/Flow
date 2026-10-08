import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc, count, gte, lt, sql } from 'drizzle-orm';
import { Decimal } from 'decimal.js';

import { coupons } from '@server/database/schema';
import type {
  Coupon,
  CouponListResponse,
  CreateCouponRequest,
  UpdateCouponRequest,
  ValidateCouponResponse,
} from '@shared/api.interface';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  private mapCoupon(row: typeof coupons.$inferSelect): Coupon {
    return {
      id: row.id,
      code: row.code,
      type: row.type as any,
      value: row.value.toString(),
      minOrderAmount: row.minOrderAmount.toString(),
      totalQuantity: Number(row.totalQuantity),
      usedCount: Number(row.usedCount),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : undefined,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<CouponListResponse> {
    const skip = (page - 1) * pageSize;
    const rows = await this.db
      .select()
      .from(coupons)
      .orderBy(desc(coupons.createdAt))
      .limit(pageSize)
      .offset(skip);

    const countResult = await this.db
      .select({ count: count() })
      .from(coupons);

    return {
      items: rows.map((row) => this.mapCoupon(row)),
      total: Number(countResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async create(
    dto: CreateCouponRequest,
    auditMeta?: { userId?: string; role?: string; ip?: string },
  ): Promise<Coupon> {
    if (!dto.code?.trim()) {
      throw new BadRequestException('优惠码不能为空');
    }
    if (!dto.value || dto.value <= 0) {
      throw new BadRequestException('面额必须大于 0');
    }
    if (dto.type === 'percent' && dto.value > 100) {
      throw new BadRequestException('百分比折扣不能超过 100');
    }

    const existing = await this.db
      .select({ id: coupons.id })
      .from(coupons)
      .where(eq(coupons.code, dto.code.trim().toUpperCase()));
    if (existing.length > 0) {
      throw new ConflictException('优惠码已存在');
    }

    const inserted = await this.db
      .insert(coupons)
      .values({
        sellerId: auditMeta?.userId ?? null,
        code: dto.code.trim().toUpperCase(),
        type: dto.type,
        value: dto.value.toString(),
        minOrderAmount: (dto.minOrderAmount ?? 0).toString(),
        totalQuantity: dto.totalQuantity ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        active: dto.active ?? true,
      })
      .returning();

    const coupon = this.mapCoupon(inserted[0]);

    // Audit log for coupon creation
    try {
      void this.auditService.log({
        action: 'coupon.create',
        entity: 'coupon',
        entityId: coupon.id,
        after: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
        },
        userId: auditMeta?.userId,
        role: auditMeta?.role,
        ip: auditMeta?.ip,
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return coupon;
  }

  async update(id: string, dto: UpdateCouponRequest): Promise<Coupon> {
    const rows = await this.db.select().from(coupons).where(eq(coupons.id, id));
    if (rows.length === 0) {
      throw new NotFoundException('优惠券不存在');
    }

    const patch: Partial<typeof coupons.$inferInsert> = {};
    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      const dup = await this.db
        .select({ id: coupons.id })
        .from(coupons)
        .where(and(eq(coupons.code, code), eq(coupons.id, id)));
      if (dup.length > 0 && dup[0].id !== id) {
        throw new ConflictException('优惠码已存在');
      }
      patch.code = code;
    }
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.value !== undefined) patch.value = dto.value.toString();
    if (dto.minOrderAmount !== undefined) patch.minOrderAmount = dto.minOrderAmount.toString();
    if (dto.totalQuantity !== undefined) patch.totalQuantity = dto.totalQuantity;
    if (dto.expiresAt !== undefined) {
      patch.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.active !== undefined) patch.active = dto.active;

    if (Object.keys(patch).length === 0) {
      return this.mapCoupon(rows[0]);
    }

    const updated = await this.db
      .update(coupons)
      .set(patch)
      .where(eq(coupons.id, id))
      .returning();

    return this.mapCoupon(updated[0]);
  }

  async validate(code: string, orderAmountStr: string): Promise<ValidateCouponResponse> {
    if (!code?.trim()) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: Number(orderAmountStr),
        message: '请输入优惠码',
      };
    }

    const orderAmount = new Decimal(orderAmountStr);

    const rows = await this.db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.trim().toUpperCase()));

    if (rows.length === 0) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: orderAmount.toNumber(),
        message: '优惠码不存在',
      };
    }

    const coupon = rows[0];

    if (!coupon.active) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: orderAmount.toNumber(),
        message: '该优惠码已停用',
      };
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: orderAmount.toNumber(),
        message: '该优惠码已过期',
      };
    }

    if (Number(coupon.usedCount) >= Number(coupon.totalQuantity)) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: orderAmount.toNumber(),
        message: '该优惠码已用完',
      };
    }

    const minOrderAmount = new Decimal(coupon.minOrderAmount as string);
    if (orderAmount.lt(minOrderAmount)) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: orderAmount.toNumber(),
        message: `订单金额需满 ¥${minOrderAmount.toFixed(2)} 才能使用`,
      };
    }

    let discountAmount: Decimal;
    if (coupon.type === 'percent') {
      const value = new Decimal(coupon.value as string);
      discountAmount = orderAmount.mul(value).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      discountAmount = new Decimal(coupon.value as string);
    }

    if (discountAmount.gt(orderAmount)) {
      discountAmount = orderAmount;
    }

    const finalAmount = orderAmount.minus(discountAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      valid: true,
      coupon: this.mapCoupon(coupon),
      discountAmount: discountAmount.toNumber(),
      finalAmount: finalAmount.toNumber(),
    };
  }

  async getCouponByCode(code: string): Promise<typeof coupons.$inferSelect | null> {
    const rows = await this.db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.trim().toUpperCase()));
    return rows[0] ?? null;
  }

  async incrementUsedCount(
    id: string,
    auditMeta?: { userId?: string; role?: string; ip?: string; orderId?: string },
  ): Promise<void> {
    await this.db
      .update(coupons)
      .set({ usedCount: sql`${coupons.usedCount} + 1` })
      .where(eq(coupons.id, id));

    // Audit log for coupon redemption
    try {
      const couponRows = await this.db
        .select({ code: coupons.code, usedCount: coupons.usedCount })
        .from(coupons)
        .where(eq(coupons.id, id));
      if (couponRows.length > 0) {
        void this.auditService.log({
          action: 'coupon.redeem',
          entity: 'coupon',
          entityId: id,
          after: {
            orderId: auditMeta?.orderId,
            usedCount: Number(couponRows[0].usedCount),
          },
          userId: auditMeta?.userId,
          role: auditMeta?.role,
          ip: auditMeta?.ip,
        });
      }
    } catch {
      // Audit log failure must not affect main flow
    }
  }
}
