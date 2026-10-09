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
import { eq, and, desc, count, gte, lt, sql, inArray } from 'drizzle-orm';
import { Decimal } from 'decimal.js';

import { cartItems, products, productVariants, cartRecoveryCodes } from '@server/database/schema';
import type { CartResponse, CartItem } from '@shared/api.interface';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  /** Find the first active variant for a product (fallback to first variant) */
  private findDefaultVariant(variants: Array<typeof productVariants.$inferSelect>): typeof productVariants.$inferSelect | null {
    const active = variants.find((v) => v.status === 'active');
    return active ?? variants[0] ?? null;
  }

  async getCart(userId: string | undefined, sessionId: string | undefined): Promise<CartResponse> {
    let whereCondition;
    if (userId) {
      whereCondition = eq(cartItems.userId, userId);
    } else if (sessionId) {
      whereCondition = eq(cartItems.sessionId, sessionId);
    } else {
      return { items: [], subtotal: '0.00', total: '0.00', itemCount: 0 };
    }

    const rows = await this.db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        variantId: cartItems.variantId,
        quantity: cartItems.quantity,
        productTitleEn: products.titleEn,
        productTitleZh: products.titleZh,
        productCoverImage: products.coverImage,
        productStatus: products.status,
        productImages: products.images,
        productTotalStock: products.totalStock,
        productTotalSold: products.totalSold,
        productWeight: products.weight,
        productBulletPointsZh: products.bulletPointsZh,
        bulletPointsEn: products.bulletPointsEn,
        productSeoKeywordsZh: products.seoKeywordsZh,
        productSeoKeywordsEn: products.seoKeywordsEn,
        productLongDescZh: products.longDescZh,
        productLongDescEn: products.longDescEn,
        productDescZh: products.descZh,
        productDescEn: products.descEn,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(whereCondition)
      .orderBy(desc(cartItems.createdAt));

    if (rows.length === 0) {
      return { items: [], subtotal: '0.00', total: '0.00', itemCount: 0 };
    }

    // Collect all product IDs to batch-load variants
    const productIds = [...new Set(rows.map((r) => r.productId))];
    const variantRows = await this.db
      .select()
      .from(productVariants)
      .where(and(
        inArray(productVariants.productId, productIds),
        eq(productVariants.status, 'active'),
      ));

    const variantsByProduct = new Map<string, Array<typeof productVariants.$inferSelect>>();
    for (const v of variantRows) {
      const arr = variantsByProduct.get(v.productId) ?? [];
      arr.push(v);
      variantsByProduct.set(v.productId, arr);
    }

    const items: CartItem[] = rows.map((row) => {
      // Determine which variant to use
      const productVariants2 = variantsByProduct.get(row.productId) ?? [];
      let variant = row.variantId
        ? productVariants2.find((v) => v.id === row.variantId) ?? null
        : null;
      if (!variant) {
        variant = this.findDefaultVariant(productVariants2);
      }

      const price = variant ? (variant.price as string) : '0';
      const originalPrice = variant ? (variant.originalPrice as string | undefined) : undefined;
      const stock = variant ? variant.stock : Number(row.productTotalStock ?? 0);
      const sold = variant ? variant.sold : Number(row.productTotalSold ?? 0);
      const sku = variant?.sku ?? undefined;
      const variantImage = variant?.image ?? undefined;
      const variantInfo = variant?.optionValues && Array.isArray(variant.optionValues) && variant.optionValues.length > 0
        ? variant.optionValues.join(' / ')
        : undefined;

      return {
        id: row.id,
        productId: row.productId,
        variantId: variant?.id,
        quantity: row.quantity,
        variantInfo,
        variantImage,
        product: {
          id: row.productId,
          sku,
          titleZh: row.productTitleZh,
          titleEn: row.productTitleEn,
          descZh: row.productDescZh ?? '',
          descEn: row.productDescEn ?? '',
          longDescZh: row.productLongDescZh ?? '',
          longDescEn: row.productLongDescEn ?? '',
          categoryId: undefined,
          price,
          originalPrice,
          stock,
          sold,
          status: row.productStatus as 'draft' | 'active' | 'inactive',
          coverImage: variantImage ?? row.productCoverImage ?? undefined,
          images: (row.productImages as string[] | null) ?? [],
          specs: {},
          seoKeywordsZh: row.productSeoKeywordsZh ?? '',
          seoKeywordsEn: row.productSeoKeywordsEn ?? '',
          bulletPointsZh: (row.productBulletPointsZh as string[]) ?? [],
          bulletPointsEn: (row.bulletPointsEn as string[]) ?? [],
          weight: row.productWeight?.toString(),
          createdAt: '',
          updatedAt: '',
        },
      };
    });

    let subtotalNum = 0;
    let itemCount = 0;
    for (const item of items) {
      subtotalNum += Number(item.product.price) * item.quantity;
      itemCount += item.quantity;
    }

    const subtotal = subtotalNum.toFixed(2);

    return {
      items,
      subtotal,
      total: subtotal,
      itemCount,
    };
  }

  async addItem(
    userId: string | undefined,
    sessionId: string | undefined,
    productId: string,
    quantity: number,
    variantId?: string,
  ): Promise<CartResponse> {
    if (!productId) {
      throw new BadRequestException('productId 不能为空');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('quantity 必须是正整数');
    }

    const productRows = await this.db
      .select({ id: products.id, status: products.status })
      .from(products)
      .where(eq(products.id, productId));

    if (productRows.length === 0) {
      throw new NotFoundException('商品不存在');
    }
    const product = productRows[0];
    if (product.status !== 'active') {
      throw new BadRequestException('商品已下架');
    }

    if (!userId && !sessionId) {
      throw new BadRequestException('无法识别购物车');
    }

    // Resolve variant
    let resolvedVariantId = variantId;
    if (!resolvedVariantId) {
      const variants = await this.db
        .select()
        .from(productVariants)
        .where(and(
          eq(productVariants.productId, productId),
          eq(productVariants.status, 'active'),
        ))
        .limit(1);
      if (variants.length > 0) {
        resolvedVariantId = variants[0].id;
      }
    }

    const sessionVal = userId ? userId : (sessionId as string);
    const userIdVal = userId ?? null;

    // Build existing query conditions
    const conditions = [eq(cartItems.productId, productId)];
    if (userId) {
      conditions.push(eq(cartItems.userId, userId));
    } else {
      conditions.push(eq(cartItems.sessionId, sessionVal));
    }
    if (resolvedVariantId) {
      conditions.push(eq(cartItems.variantId, resolvedVariantId));
    } else {
      conditions.push(sql`${cartItems.variantId} IS NULL`);
    }

    const existingRows = await this.db
      .select({ id: cartItems.id, quantity: cartItems.quantity })
      .from(cartItems)
      .where(and(...conditions));

    let newQty: number;
    let itemId: string;

    if (existingRows.length > 0) {
      newQty = existingRows[0].quantity + quantity;
      itemId = existingRows[0].id;
      await this.db
        .update(cartItems)
        .set({ quantity: newQty })
        .where(eq(cartItems.id, itemId));
    } else {
      newQty = quantity;
      const inserted = await this.db
        .insert(cartItems)
        .values({
          productId,
          variantId: resolvedVariantId ?? null,
          quantity,
          sessionId: sessionVal,
          userId: userIdVal,
        })
        .returning({ id: cartItems.id });
      itemId = inserted[0].id;
    }

    // Check stock against variant
    if (resolvedVariantId) {
      const variantRows = await this.db
        .select({ stock: productVariants.stock })
        .from(productVariants)
        .where(eq(productVariants.id, resolvedVariantId));
      if (variantRows.length > 0 && newQty > variantRows[0].stock) {
        await this.db
          .update(cartItems)
          .set({ quantity: variantRows[0].stock })
          .where(eq(cartItems.id, itemId));
        throw new BadRequestException('库存不足');
      }
    }

    return this.getCart(userId, sessionId);
  }

  async updateItem(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
    quantity: number,
  ): Promise<CartResponse> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('quantity 必须是正整数');
    }

    let whereCondition;
    if (userId) {
      whereCondition = and(eq(cartItems.id, itemId), eq(cartItems.userId, userId));
    } else if (sessionId) {
      whereCondition = and(eq(cartItems.id, itemId), eq(cartItems.sessionId, sessionId));
    } else {
      throw new BadRequestException('无法识别购物车');
    }

    const existingRows = await this.db
      .select({ id: cartItems.id, productId: cartItems.productId, variantId: cartItems.variantId })
      .from(cartItems)
      .where(whereCondition);

    if (existingRows.length === 0) {
      throw new NotFoundException('购物车商品不存在');
    }

    // Check stock against variant
    const cartItem2 = existingRows[0];
    if (cartItem2.variantId) {
      const variantRows = await this.db
        .select({ stock: productVariants.stock })
        .from(productVariants)
        .where(eq(productVariants.id, cartItem2.variantId));

      if (variantRows.length === 0 || variantRows[0].stock < quantity) {
        throw new BadRequestException('库存不足');
      }
    } else {
      // Fallback to product-level stock
      const productRows = await this.db
        .select({ totalStock: products.totalStock })
        .from(products)
        .where(eq(products.id, cartItem2.productId));

      if (productRows.length === 0 || Number(productRows[0].totalStock) < quantity) {
        throw new BadRequestException('库存不足');
      }
    }

    await this.db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, itemId));

    return this.getCart(userId, sessionId);
  }

  async removeItem(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
  ): Promise<CartResponse> {
    let whereCondition;
    if (userId) {
      whereCondition = and(eq(cartItems.id, itemId), eq(cartItems.userId, userId));
    } else if (sessionId) {
      whereCondition = and(eq(cartItems.id, itemId), eq(cartItems.sessionId, sessionId));
    } else {
      throw new BadRequestException('无法识别购物车');
    }

    const result = await this.db
      .delete(cartItems)
      .where(whereCondition)
      .returning({ id: cartItems.id });

    if (result.length === 0) {
      throw new NotFoundException('购物车商品不存在');
    }

    return this.getCart(userId, sessionId);
  }

  async clearCart(userId: string | undefined, sessionId: string | undefined): Promise<void> {
    if (userId) {
      await this.db.delete(cartItems).where(eq(cartItems.userId, userId));
    } else if (sessionId) {
      await this.db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
    }
  }

  private generateRecoveryCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 12; i += 1) {
      const idx = Math.floor(Math.random() * chars.length);
      code += chars[idx];
    }
    return code;
  }

  async exportRecoveryCode(sessionId: string): Promise<{ code: string }> {
    const cart = await this.getCart(undefined, sessionId);
    if (cart.items.length === 0) {
      throw new BadRequestException('购物车为空，无法生成恢复码');
    }

    const code = this.generateRecoveryCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.db.insert(cartRecoveryCodes).values({
      code,
      sessionId,
      expiresAt,
    });

    return { code };
  }

  async importRecoveryCode(
    currentSessionId: string,
    code: string,
  ): Promise<CartResponse> {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      throw new BadRequestException('恢复码不能为空');
    }

    const now = new Date();
    const codeRows = await this.db
      .select({
        id: cartRecoveryCodes.id,
        sessionId: cartRecoveryCodes.sessionId,
        used: cartRecoveryCodes.used,
        expiresAt: cartRecoveryCodes.expiresAt,
      })
      .from(cartRecoveryCodes)
      .where(eq(cartRecoveryCodes.code, trimmedCode));

    if (codeRows.length === 0) {
      throw new BadRequestException('恢复码不存在');
    }

    const recoveryRecord = codeRows[0];

    if (recoveryRecord.used) {
      throw new BadRequestException('恢复码已被使用');
    }

    if (recoveryRecord.expiresAt <= now) {
      throw new BadRequestException('恢复码已过期');
    }

    const sourceItems = await this.db
      .select({
        productId: cartItems.productId,
        variantId: cartItems.variantId,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .where(eq(cartItems.sessionId, recoveryRecord.sessionId));

    if (sourceItems.length === 0) {
      await this.db
        .update(cartRecoveryCodes)
        .set({ used: true })
        .where(eq(cartRecoveryCodes.id, recoveryRecord.id));
      return this.getCart(undefined, currentSessionId);
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(cartRecoveryCodes)
        .set({ used: true })
        .where(eq(cartRecoveryCodes.id, recoveryRecord.id));

      for (const item of sourceItems) {
        await tx
          .insert(cartItems)
          .values({
            sessionId: currentSessionId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })
          .onConflictDoUpdate({
            target: [cartItems.sessionId, cartItems.productId, cartItems.variantId],
            set: {
              quantity: sql<number>`${cartItems.quantity} + ${item.quantity}`,
            },
          });
      }
    });

    return this.getCart(undefined, currentSessionId);
  }
}
