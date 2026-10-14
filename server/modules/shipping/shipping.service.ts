import { Injectable, Inject, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc } from 'drizzle-orm';

import { shippingTemplates, orders } from '../../database/schema';
import { computeShippingFee } from './shipping-fee';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  // ==================== CRUD ====================

  async create(sellerId: string, dto: {
    name: string;
    freeShippingThreshold?: string;
    baseFee?: string;
    extraFeePerUnit?: string;
    unitType?: string;
    specialZones?: string;
    isDefault?: boolean;
  }) {
    // If setting as default, clear existing default first
    if (dto.isDefault) {
      await this.db
        .update(shippingTemplates)
        .set({ isDefault: false })
        .where(and(
          eq(shippingTemplates.sellerId, sellerId),
          eq(shippingTemplates.isDefault, true),
        ));
    }

    const inserted = await this.db
      .insert(shippingTemplates)
      .values({
        sellerId,
        name: dto.name,
        freeShippingThreshold: dto.freeShippingThreshold ?? '0',
        baseFee: dto.baseFee ?? '0',
        extraFeePerUnit: dto.extraFeePerUnit ?? '0',
        unitType: dto.unitType ?? 'quantity',
        specialZones: dto.specialZones ?? null,
        isDefault: dto.isDefault ?? false,
      })
      .returning();

    return inserted[0];
  }

  async update(id: string, sellerId: string, dto: {
    name?: string;
    freeShippingThreshold?: string;
    baseFee?: string;
    extraFeePerUnit?: string;
    unitType?: string;
    specialZones?: string;
    isDefault?: boolean;
  }) {
    const existing = await this.getOne(id, sellerId);

    // If setting as default, clear existing default first
    if (dto.isDefault) {
      await this.db
        .update(shippingTemplates)
        .set({ isDefault: false })
        .where(and(
          eq(shippingTemplates.sellerId, sellerId),
          eq(shippingTemplates.isDefault, true),
        ));
    }

    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.freeShippingThreshold !== undefined) updates.freeShippingThreshold = dto.freeShippingThreshold;
    if (dto.baseFee !== undefined) updates.baseFee = dto.baseFee;
    if (dto.extraFeePerUnit !== undefined) updates.extraFeePerUnit = dto.extraFeePerUnit;
    if (dto.unitType !== undefined) updates.unitType = dto.unitType;
    if (dto.specialZones !== undefined) updates.specialZones = dto.specialZones;
    if (dto.isDefault !== undefined) updates.isDefault = dto.isDefault;

    const updated = await this.db
      .update(shippingTemplates)
      .set(updates)
      .where(and(
        eq(shippingTemplates.id, id),
        eq(shippingTemplates.sellerId, sellerId),
      ))
      .returning();

    return updated[0] ?? existing;
  }

  async remove(id: string, sellerId: string) {
    const existing = await this.getOne(id, sellerId);

    // Check if template is used by any order
    const usedByOrders = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(
        eq(orders.sellerId, sellerId),
        eq(orders.shippingTemplateId, id),
      ))
      .limit(1);

    if (usedByOrders.length > 0) {
      throw new ConflictException('该运费模板已被订单使用，无法删除');
    }

    // Cannot delete the default template if it's the only one
    if (existing.isDefault) {
      const siblingCount = await this.db
        .select({ id: shippingTemplates.id })
        .from(shippingTemplates)
        .where(eq(shippingTemplates.sellerId, sellerId));

      if (siblingCount.length <= 1) {
        throw new ConflictException('无法删除唯一的默认运费模板');
      }
    }

    await this.db
      .delete(shippingTemplates)
      .where(and(
        eq(shippingTemplates.id, id),
        eq(shippingTemplates.sellerId, sellerId),
      ));

    return { success: true };
  }

  async list(sellerId: string) {
    return this.db
      .select()
      .from(shippingTemplates)
      .where(eq(shippingTemplates.sellerId, sellerId))
      .orderBy(desc(shippingTemplates.isDefault), desc(shippingTemplates.createdAt));
  }

  async getOne(id: string, sellerId: string) {
    const rows = await this.db
      .select()
      .from(shippingTemplates)
      .where(and(
        eq(shippingTemplates.id, id),
        eq(shippingTemplates.sellerId, sellerId),
      ));

    if (rows.length === 0) {
      throw new NotFoundException('运费模板不存在');
    }

    return rows[0];
  }

  // ==================== Internal ====================

  async _getDefault(sellerId: string) {
    const rows = await this.db
      .select()
      .from(shippingTemplates)
      .where(and(
        eq(shippingTemplates.sellerId, sellerId),
        eq(shippingTemplates.isDefault, true),
      ));

    return rows[0] ?? null;
  }

  // ==================== Calculation ====================

  async calculateShipping(
    sellerId: string,
    country: string,
    weightTotal: number,
    qtyTotal: number,
    subtotal: number,
  ): Promise<string> {
    const tpl = await this._getDefault(sellerId);
    return computeShippingFee(tpl, { country, weightTotal, qtyTotal, subtotal }).fee;
  }

  /**
   * 买家结算报价（公开接口调用）：按全局默认模板计算。
   * 单店铺部署下默认模板即全店运费规则；下单时服务端会用同一函数重算，以其结果为准。
   */
  async quoteForBuyer(input: {
    country?: string;
    weightTotal?: number;
    qtyTotal?: number;
    subtotal: number;
  }): Promise<{ fee: string; templateId: string | null }> {
    const template = await this._getAnyDefault();
    const quote = computeShippingFee(template, input);
    return { fee: quote.fee, templateId: template?.id ?? null };
  }

  private async _getAnyDefault() {
    const rows = await this.db
      .select()
      .from(shippingTemplates)
      .where(eq(shippingTemplates.isDefault, true))
      .orderBy(desc(shippingTemplates.createdAt))
      .limit(1);

    return rows[0] ?? null;
  }
}
