import { Injectable, Inject, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc, or, isNull, sql } from 'drizzle-orm';

import { cartItems, products, cartRecoveryCodes } from '@server/database/schema';
import type { CartResponse, CartItem } from '@shared/api.interface';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

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
        quantity: cartItems.quantity,
        productTitleEn: products.titleEn,
        productTitleZh: products.titleZh,
        productPrice: products.price,
        productCoverImage: products.coverImage,
        productStatus: products.status,
        productStock: products.stock,
        productImages: products.images,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(whereCondition)
      .orderBy(desc(cartItems.createdAt));

    const items: CartItem[] = rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      quantity: row.quantity,
      product: {
        id: row.productId,
        titleZh: row.productTitleZh,
        titleEn: row.productTitleEn,
        descZh: '',
        descEn: '',
        longDescZh: '',
        longDescEn: '',
        price: row.productPrice as string,
        stock: row.productStock,
        sold: 0,
        status: row.productStatus as 'draft' | 'active' | 'inactive',
        coverImage: row.productCoverImage ?? undefined,
        images: (row.productImages as string[] | null) ?? [],
        specs: {},
        seoKeywordsZh: '',
        seoKeywordsEn: '',
        bulletPointsZh: [],
        bulletPointsEn: [],
        createdAt: '',
        updatedAt: '',
      },
    }));

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
  ): Promise<CartResponse> {
    if (!productId) {
      throw new BadRequestException('productId 不能为空');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('quantity 必须是正整数');
    }

    const productRows = await this.db
      .select({ id: products.id, stock: products.stock, status: products.status })
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

    const sessionVal = userId ? userId : (sessionId as string);
    const userIdVal = userId ?? null;

    const existingCondition = userId
      ? and(eq(cartItems.userId, userId), eq(cartItems.productId, productId))
      : and(eq(cartItems.sessionId, sessionVal), eq(cartItems.productId, productId));

    const existingRows = await this.db
      .select({ id: cartItems.id, quantity: cartItems.quantity })
      .from(cartItems)
      .where(existingCondition);

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
          quantity,
          sessionId: sessionVal,
          userId: userIdVal,
        })
        .returning({ id: cartItems.id });
      itemId = inserted[0].id;
    }

    if (newQty > product.stock) {
      await this.db
        .update(cartItems)
        .set({ quantity: product.stock })
        .where(eq(cartItems.id, itemId));
      throw new BadRequestException('库存不足');
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
      .select({ id: cartItems.id, productId: cartItems.productId })
      .from(cartItems)
      .where(whereCondition);

    if (existingRows.length === 0) {
      throw new NotFoundException('购物车商品不存在');
    }

    const productRows = await this.db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, existingRows[0].productId));

    if (productRows.length === 0 || productRows[0].stock < quantity) {
      throw new BadRequestException('库存不足');
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
            quantity: item.quantity,
          })
          .onConflictDoUpdate({
            target: [cartItems.sessionId, cartItems.productId],
            set: {
              quantity: sql<number>`${cartItems.quantity} + ${item.quantity}`,
            },
          });
      }
    });

    return this.getCart(undefined, currentSessionId);
  }
}
