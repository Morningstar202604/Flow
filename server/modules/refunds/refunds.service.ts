import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc, count, ilike, or, sql } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { nanoid } from 'nanoid';

import {
  payments, refunds, orders, orderItems,
  products, productVariants, stockMovements,
} from '@server/database/schema';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';

/** Parsed shape of the refunds.items JSON field */
interface RefundItemEntry {
  orderItemId: string;
  quantity: number;
}


@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // ==================== Helpers ====================

  private generateRefundNo(): string {
    return `RF${Date.now()}${nanoid(6).toUpperCase()}`;
  }

  private parseRefundItems(raw: string | null): RefundItemEntry[] | undefined {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as RefundItemEntry[];
    } catch {
      return undefined;
    }
  }

  private getPaymentsService(): PaymentsService {
    return this.moduleRef.get(PaymentsService, { strict: false });
  }

  private mapRefund(row: typeof refunds.$inferSelect) {
    return {
      id: row.id,
      orderId: row.orderId,
      userId: row.userId,
      refundNo: row.refundNo,
      status: row.status,
      amount: row.amount as string,
      reason: row.reason,
      reasonDetail: row.reasonDetail ?? undefined,
      items: this.parseRefundItems(row.items),
      sellerReply: row.sellerReply ?? undefined,
      refundMethod: row.refundMethod,
      approvedAt: row.approvedAt ? row.approvedAt.toISOString() : undefined,
      completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async loadOrder(orderId: string) {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }
    return orderRows[0];
  }

  private async loadRefund(refundId: string) {
    const refundRows = await this.db.select().from(refunds).where(eq(refunds.id, refundId));
    if (refundRows.length === 0) {
      throw new NotFoundException('退款记录不存在');
    }
    return refundRows[0];
  }

  // ==================== Buyer: Request Refund ====================

  async requestRefund(
    orderId: string,
    userId: string,
    dto: {
      amount?: string;
      reason: string;
      reasonDetail?: string;
      items?: Array<{ orderItemId: string; quantity: number }>;
      refundMethod?: string;
    },
  ) {
    const order = await this.loadOrder(orderId);

    if (order.userId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }

    const refundableStatuses = ['paid', 'shipped', 'delivered'];
    if (!refundableStatuses.includes(order.status)) {
      throw new BadRequestException('当前订单状态不可申请退款');
    }

    // Check for existing pending refund
    const existingRefundsRows = await this.db
      .select({ id: refunds.id })
      .from(refunds)
      .where(and(
        eq(refunds.orderId, orderId),
        ilike(refunds.status, 'requested'),
      ));
    if (existingRefundsRows.length > 0) {
      throw new ConflictException('已有待处理的退款申请');
    }

    // Calculate refund amount
    let refundAmount: Decimal;
    if (dto.items && dto.items.length > 0) {
      refundAmount = new Decimal(0);
      for (const refundItem of dto.items) {
        const itemRows = await this.db
          .select({ unitPrice: orderItems.unitPrice, quantity: orderItems.quantity })
          .from(orderItems)
          .where(and(
            eq(orderItems.id, refundItem.orderItemId),
            eq(orderItems.orderId, orderId),
          ));
        if (itemRows.length === 0) continue;
        const item = itemRows[0];
        refundAmount = refundAmount.plus(
          new Decimal(item.unitPrice as string).mul(refundItem.quantity),
        );
      }
    } else if (dto.amount) {
      refundAmount = new Decimal(dto.amount);
    } else {
      refundAmount = new Decimal(order.totalAmount as string);
    }

    if (refundAmount.lte(0)) {
      throw new BadRequestException('退款金额必须大于 0');
    }

    const orderTotal = new Decimal(order.totalAmount as string);
    if (refundAmount.gt(orderTotal)) {
      throw new BadRequestException('退款金额不能超过订单总额');
    }

    const refundNo = this.generateRefundNo();

    const inserted = await this.db
      .insert(refunds)
      .values({
        orderId,
        userId,
        refundNo,
        status: 'requested',
        amount: refundAmount.toFixed(2),
        reason: dto.reason,
        reasonDetail: dto.reasonDetail ?? null,
        items: dto.items ? JSON.stringify(dto.items) : null,
        refundMethod: dto.refundMethod ?? 'original',
      })
      .returning();

    const refund = inserted[0];

    try {
      void this.auditService.log({
        action: 'refund.request',
        entity: 'refund',
        entityId: refund.id,
        after: {
          orderId,
          amount: refundAmount.toFixed(2),
          reason: dto.reason,
        },
        userId,
        role: 'buyer',
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return this.mapRefund(refund);
  }

  // ==================== Seller: Approve Refund ====================

  async approveRefund(
    refundId: string,
    sellerId: string,
    dto?: { reply?: string },
  ) {
    const refund = await this.loadRefund(refundId);

    if (refund.status !== 'requested') {
      throw new BadRequestException('仅待处理退款可审批');
    }

    const order = await this.loadOrder(refund.orderId);
    const refundAmount = new Decimal(refund.amount as string);

    // Process payment refund through PaymentsService
    // Need to find the payment record's internal UUID by orderId
    const paymentRows = await this.db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, order.id), eq(payments.status, 'paid')))
      .orderBy(desc(payments.createdAt))
      .limit(1);

    if (paymentRows.length > 0) {
      try {
        const paymentsService = this.getPaymentsService();
        const refundItems = this.parseRefundItems(refund.items);
        const isPartialRefund = refundItems !== undefined && refundItems.length > 0;

        await paymentsService.processRefund(
          paymentRows[0].id,
          isPartialRefund ? Number(refundAmount.toFixed(2)) : undefined,
        );
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.error(`Payment refund failed for refund ${refundId}: ${msg}`);
        throw new BadRequestException(`支付退款失败: ${msg}`);
      }
    }

    // Update refund status and restore stock
    const now = new Date();
    const result = await this.db.transaction(async (tx) => {
      const updatedRefundRows = await tx
        .update(refunds)
        .set({
          status: 'completed',
          sellerReply: dto?.reply ?? null,
          approvedAt: now,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(refunds.id, refundId))
        .returning();

      // Restore stock if partial refund with specific items
      const refundItemsList = this.parseRefundItems(refund.items);
      if (refundItemsList && refundItemsList.length > 0) {
        for (const refundItem of refundItemsList) {
          const itemRows = await tx
            .select({ variantId: orderItems.variantId, productId: orderItems.productId })
            .from(orderItems)
            .where(eq(orderItems.id, refundItem.orderItemId));

          if (itemRows.length > 0) {
            const { variantId, productId } = itemRows[0];
            if (variantId) {
              await tx
                .update(productVariants)
                .set({
                  stock: sql`${productVariants.stock} + ${refundItem.quantity}`,
                  sold: sql`GREATEST(${productVariants.sold} - ${refundItem.quantity}, 0)`,
                  updatedAt: now,
                })
                .where(eq(productVariants.id, variantId));

              // Record stock movement
              await tx.insert(stockMovements).values({
                variantId,
                quantity: refundItem.quantity,
                reason: 'refund_return',
                referenceId: refundId,
                note: `Refund approved: ${refund.refundNo}`,
                createdBy: sellerId,
              });
            }
            if (productId) {
              await tx
                .update(products)
                .set({
                  totalStock: sql`${products.totalStock} + ${refundItem.quantity}`,
                  totalSold: sql`GREATEST(${products.totalSold} - ${refundItem.quantity}, 0)`,
                  updatedAt: now,
                })
                .where(eq(products.id, productId));
            }
          }
        }
      }

      // Determine if this is a partial or full refund
      const orderTotal = new Decimal(order.totalAmount as string);
      const isPartialRefund = refundAmount.lt(orderTotal);

      // Update order status
      await tx
        .update(orders)
        .set({
          status: isPartialRefund ? 'partially_refunded' : 'refunded',
          updatedAt: now,
        })
        .where(eq(orders.id, refund.orderId));

      return updatedRefundRows[0];
    });

    try {
      void this.auditService.log({
        action: 'refund.approve',
        entity: 'refund',
        entityId: refundId,
        before: { status: refund.status },
        after: { status: 'completed', approvedAt: now.toISOString() },
        userId: sellerId,
        role: 'seller',
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return this.mapRefund(result);
  }

  // ==================== Seller: Reject Refund ====================

  async rejectRefund(
    refundId: string,
    sellerId: string,
    dto: { reply: string },
  ) {
    const refund = await this.loadRefund(refundId);

    if (refund.status !== 'requested') {
      throw new BadRequestException('仅待处理退款可拒绝');
    }

    if (!dto.reply?.trim()) {
      throw new BadRequestException('拒绝退款需要说明原因');
    }

    const now = new Date();
    const updatedRows = await this.db
      .update(refunds)
      .set({
        status: 'rejected',
        sellerReply: dto.reply.trim(),
        updatedAt: now,
      })
      .where(eq(refunds.id, refundId))
      .returning();

    try {
      void this.auditService.log({
        action: 'refund.reject',
        entity: 'refund',
        entityId: refundId,
        before: { status: refund.status },
        after: { status: 'rejected', reply: dto.reply.trim() },
        userId: sellerId,
        role: 'seller',
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return this.mapRefund(updatedRows[0]);
  }

  // ==================== Seller: List Refunds ====================

  async listForSeller(
    sellerId: string,
    query: { status?: string; page?: string; pageSize?: string; keyword?: string },
  ) {
    const whereConditions = [];

    // Filter by status
    if (query.status) {
      whereConditions.push(eq(refunds.status, query.status as typeof refunds.status.enumValues[number]));
    }

    // Filter by keyword (refundNo only — orderId is UUID and not suitable for ilike)
    if (query.keyword && query.keyword.trim()) {
      const kw = `%${query.keyword.trim()}%`;
      whereConditions.push(or(
        ilike(refunds.refundNo, kw),
        ilike(sql`${refunds.orderId}::text`, kw),
      ));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Pagination
    const page = query.page ? Math.max(1, parseInt(query.page, 10)) : 1;
    const pageSize = query.pageSize ? Math.min(50, Math.max(1, parseInt(query.pageSize, 10))) : 10;

    const countResult = await this.db
      .select({ count: count() })
      .from(refunds)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    const offset = (page - 1) * pageSize;
    const refundRows = await this.db
      .select()
      .from(refunds)
      .where(whereClause)
      .orderBy(desc(refunds.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: refundRows.map((row) => this.mapRefund(row)),
      total,
      page,
      pageSize,
    };
  }

  // ==================== Buyer: List Own Refunds ====================

  async listForUser(
    userId: string,
    query: { status?: string; page?: string; pageSize?: string },
  ) {
    const whereConditions = [eq(refunds.userId, userId)];

    if (query.status) {
      whereConditions.push(eq(refunds.status, query.status as typeof refunds.status.enumValues[number]));
    }

    const whereClause = and(...whereConditions);

    const page = query.page ? Math.max(1, parseInt(query.page, 10)) : 1;
    const pageSize = query.pageSize ? Math.min(50, Math.max(1, parseInt(query.pageSize, 10))) : 10;

    const countResult = await this.db
      .select({ count: count() })
      .from(refunds)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    const offset = (page - 1) * pageSize;
    const refundRows = await this.db
      .select()
      .from(refunds)
      .where(whereClause)
      .orderBy(desc(refunds.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: refundRows.map((row) => this.mapRefund(row)),
      total,
      page,
      pageSize,
    };
  }

  // ==================== Get Detail ====================

  async getDetail(refundId: string, userId?: string) {
    const refund = await this.loadRefund(refundId);

    // If userId provided, check ownership
    if (userId && refund.userId !== userId) {
      throw new ForbiddenException('无权查看该退款记录');
    }

    return this.mapRefund(refund);
  }
}
