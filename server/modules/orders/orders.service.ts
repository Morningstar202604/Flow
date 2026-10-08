import { Injectable, Inject, Logger, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc, count, ilike, or, inArray, sql, gte, lt } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { nanoid } from 'nanoid';

import { orders, orderItems, products, cartItems, coupons } from '@server/database/schema';
import { CouponsService } from '../coupons/coupons.service';
import { AuditService } from '../audit/audit.service';
import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderListResponse,
  CreateOrderRequest,
  OrderStatusUpdateRequest,
} from '@shared/api.interface';

const STATUS_ORDER: OrderStatus[] = ['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled'];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly couponsService: CouponsService,
    private readonly auditService: AuditService,
  ) {}

  private generateOrderNo(): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = nanoid(10).toUpperCase();
    return `ORD${dateStr}${rand}`;
  }

  private async generateUniqueOrderNo(): Promise<string> {
    for (let i = 0; i < 5; i += 1) {
      const orderNo = this.generateOrderNo();
      const existing = await this.db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.orderNo, orderNo));
      if (existing.length === 0) return orderNo;
    }
    throw new ConflictException('生成订单号失败，请重试');
  }

  private mapOrderItem(row: {
    id: string;
    productId: string | null;
    productTitle: string;
    productImage: string | null;
    price: string;
    quantity: number;
    subtotal: string;
  }): OrderItem {
    return {
      id: row.id,
      productId: row.productId ?? undefined,
      productTitle: row.productTitle,
      productImage: row.productImage ?? undefined,
      price: row.price,
      quantity: row.quantity,
      subtotal: row.subtotal,
    };
  }

  private mapOrder(orderRow: {
    id: string;
    orderNo: string;
    userId: string;
    buyerName?: string | null;
    buyerEmail: string | null;
    buyerPhone: string | null;
    shippingAddress: string;
    shippingCity: string;
    shippingZip: string | null;
    shippingCountry: string;
    totalAmount: string;
    status: string;
    paymentMethod: string | null;
    paidAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    trackingNo: string | null;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
  }, items: OrderItem[]): Order {
    return {
      id: orderRow.id,
      orderNo: orderRow.orderNo,
      userId: orderRow.userId,
      buyerName: orderRow.buyerName ?? undefined,
      buyerEmail: orderRow.buyerEmail ?? undefined,
      buyerPhone: orderRow.buyerPhone ?? undefined,
      shippingAddress: orderRow.shippingAddress,
      shippingCity: orderRow.shippingCity,
      shippingZip: orderRow.shippingZip ?? undefined,
      shippingCountry: orderRow.shippingCountry,
      totalAmount: orderRow.totalAmount,
      status: orderRow.status as OrderStatus,
      paymentMethod: orderRow.paymentMethod ?? 'demo',
      paidAt: orderRow.paidAt ? orderRow.paidAt.toISOString() : undefined,
      shippedAt: orderRow.shippedAt ? orderRow.shippedAt.toISOString() : undefined,
      deliveredAt: orderRow.deliveredAt ? orderRow.deliveredAt.toISOString() : undefined,
      trackingNo: orderRow.trackingNo ?? undefined,
      remark: orderRow.remark ?? undefined,
      items,
      createdAt: orderRow.createdAt.toISOString(),
      updatedAt: orderRow.updatedAt.toISOString(),
    };
  }

  async getOrderList(
    page: number,
    pageSize: number,
    status?: OrderStatus,
    keyword?: string,
  ): Promise<OrderListResponse> {
    const whereConditions = [];
    if (status) {
      whereConditions.push(eq(orders.status, status));
    }
    if (keyword && keyword.trim()) {
      const kw = `%${keyword.trim()}%`;
      whereConditions.push(or(
        ilike(orders.orderNo, kw),
        ilike(orders.userId, kw),
      ));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(orders)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    const offset = (page - 1) * pageSize;
    const orderRows = await this.db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    if (orderRows.length === 0) {
      return { items: [], total, page, pageSize };
    }

    const orderIds = orderRows.map((o) => o.id);
    const itemRows = await this.db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const row of itemRows) {
      const item = this.mapOrderItem({
        id: row.id,
        productId: row.productId,
        productTitle: row.productTitle,
        productImage: row.productImage,
        price: row.price as string,
        quantity: row.quantity,
        subtotal: row.subtotal as string,
      });
      const arr = itemsByOrder.get(row.orderId) ?? [];
      arr.push(item);
      itemsByOrder.set(row.orderId, arr);
    }

    const items = orderRows.map((row) => this.mapOrder(
      {
        id: row.id,
        orderNo: row.orderNo,
        userId: row.userId,
        buyerEmail: row.buyerEmail,
        buyerPhone: row.buyerPhone,
        shippingAddress: row.shippingAddress,
        shippingCity: row.shippingCity,
        shippingZip: row.shippingZip,
        shippingCountry: row.shippingCountry,
        totalAmount: row.totalAmount as string,
        status: row.status,
        paymentMethod: row.paymentMethod,
        paidAt: row.paidAt,
        shippedAt: row.shippedAt,
        deliveredAt: row.deliveredAt,
        trackingNo: row.trackingNo,
        remark: row.remark,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      itemsByOrder.get(row.id) ?? [],
    ));

    return { items, total, page, pageSize };
  }

  async getBuyerOrders(
    userId: string | undefined,
    sessionId: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<OrderListResponse> {
    let whereClause;
    if (userId) {
      whereClause = eq(orders.userId, userId);
    } else if (sessionId) {
      whereClause = eq(orders.sessionId, sessionId);
    } else {
      return { items: [], total: 0, page, pageSize };
    }

    const countResult = await this.db
      .select({ count: count() })
      .from(orders)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    const offset = (page - 1) * pageSize;
    const orderRows = await this.db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    if (orderRows.length === 0) {
      return { items: [], total, page, pageSize };
    }

    const orderIds = orderRows.map((o) => o.id);
    const itemRows = await this.db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const row of itemRows) {
      const item = this.mapOrderItem({
        id: row.id,
        productId: row.productId,
        productTitle: row.productTitle,
        productImage: row.productImage,
        price: row.price as string,
        quantity: row.quantity,
        subtotal: row.subtotal as string,
      });
      const arr = itemsByOrder.get(row.orderId) ?? [];
      arr.push(item);
      itemsByOrder.set(row.orderId, arr);
    }

    const items = orderRows.map((row) => this.mapOrder(
      {
        id: row.id,
        orderNo: row.orderNo,
        userId: row.userId,
        buyerEmail: row.buyerEmail,
        buyerPhone: row.buyerPhone,
        shippingAddress: row.shippingAddress,
        shippingCity: row.shippingCity,
        shippingZip: row.shippingZip,
        shippingCountry: row.shippingCountry,
        totalAmount: row.totalAmount as string,
        status: row.status,
        paymentMethod: row.paymentMethod,
        paidAt: row.paidAt,
        shippedAt: row.shippedAt,
        deliveredAt: row.deliveredAt,
        trackingNo: row.trackingNo,
        remark: row.remark,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      itemsByOrder.get(row.id) ?? [],
    ));

    return { items, total, page, pageSize };
  }

  async getOrderDetail(
    id: string,
    userId?: string,
    sessionId?: string,
    isSeller = false,
  ): Promise<Order> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, id));
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }
    const orderRow = orderRows[0];

    if (!isSeller) {
      const isOwner = (userId && orderRow.userId && orderRow.userId === userId)
        || (sessionId && orderRow.sessionId && orderRow.sessionId === sessionId);
      if (!isOwner) {
        throw new ForbiddenException('无权访问该订单');
      }
    }

    const itemRows = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(orderItems.createdAt);

    const items: OrderItem[] = itemRows.map((row) => this.mapOrderItem({
      id: row.id,
      productId: row.productId,
      productTitle: row.productTitle,
      productImage: row.productImage,
      price: row.price as string,
      quantity: row.quantity,
      subtotal: row.subtotal as string,
    }));

    return this.mapOrder(
      {
        id: orderRow.id,
        orderNo: orderRow.orderNo,
        userId: orderRow.userId,
        buyerEmail: orderRow.buyerEmail,
        buyerPhone: orderRow.buyerPhone,
        shippingAddress: orderRow.shippingAddress,
        shippingCity: orderRow.shippingCity,
        shippingZip: orderRow.shippingZip,
        shippingCountry: orderRow.shippingCountry,
        totalAmount: orderRow.totalAmount as string,
        status: orderRow.status,
        paymentMethod: orderRow.paymentMethod,
        paidAt: orderRow.paidAt,
        shippedAt: orderRow.shippedAt,
        deliveredAt: orderRow.deliveredAt,
        trackingNo: orderRow.trackingNo,
        remark: orderRow.remark,
        createdAt: orderRow.createdAt,
        updatedAt: orderRow.updatedAt,
      },
      items,
    );
  }

  async createOrder(
    dto: CreateOrderRequest,
    userId: string | undefined,
    sessionId?: string,
    auditMeta?: { ip?: string },
  ): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('订单商品不能为空');
    }

    const buyerName = dto.buyerName?.trim();
    if (!buyerName) {
      throw new BadRequestException('收货人姓名不能为空');
    }
    if (buyerName.length > 100) {
      throw new BadRequestException('收货人姓名不能超过 100 个字符');
    }

    const shippingAddress = dto.shippingAddress?.trim();
    if (!shippingAddress) {
      throw new BadRequestException('收货地址不能为空');
    }
    if (shippingAddress.length > 500) {
      throw new BadRequestException('收货地址不能超过 500 个字符');
    }

    const shippingCity = dto.shippingCity?.trim();
    if (!shippingCity) {
      throw new BadRequestException('城市不能为空');
    }
    if (shippingCity.length > 100) {
      throw new BadRequestException('城市不能超过 100 个字符');
    }

    const shippingCountry = dto.shippingCountry?.trim();
    if (!shippingCountry) {
      throw new BadRequestException('国家不能为空');
    }
    if (shippingCountry.length > 100) {
      throw new BadRequestException('国家不能超过 100 个字符');
    }

    if (dto.buyerEmail && dto.buyerEmail.trim()) {
      const email = dto.buyerEmail.trim();
      if (email.length > 255) {
        throw new BadRequestException('邮箱不能超过 255 个字符');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestException('邮箱格式不正确');
      }
    }

    if (dto.buyerPhone && dto.buyerPhone.trim()) {
      const phone = dto.buyerPhone.trim();
      if (phone.length > 50) {
        throw new BadRequestException('手机号不能超过 50 个字符');
      }
      const phoneRegex = /^[+]?[\d\s\-()]{6,50}$/;
      if (!phoneRegex.test(phone)) {
        throw new BadRequestException('手机号格式不正确');
      }
    }

    if (dto.shippingZip && dto.shippingZip.trim()) {
      const zip = dto.shippingZip.trim();
      if (zip.length > 20) {
        throw new BadRequestException('邮编不能超过 20 个字符');
      }
      const zipRegex = /^[\d\w\s\-]{3,20}$/;
      if (!zipRegex.test(zip)) {
        throw new BadRequestException('邮编格式不正确');
      }
    }

    if (dto.remark && dto.remark.length > 500) {
      throw new BadRequestException('备注不能超过 500 个字符');
    }

    const validPaymentMethods = new Set(['demo', 'stripe', 'paypal']);
    if (!validPaymentMethods.has(dto.paymentMethod)) {
      throw new BadRequestException('无效的支付方式');
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const productRows = await this.db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    if (productRows.length !== productIds.length) {
      throw new BadRequestException('部分商品不存在');
    }

    const productMap = new Map(productRows.map((p) => [p.id, p]));

    for (const item of dto.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException('商品数量必须是正整数');
      }
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException('商品不存在');
      }
      if (product.status !== 'active') {
        throw new BadRequestException(`商品 ${product.titleEn} 已下架`);
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(`商品 ${product.titleEn} 库存不足`);
      }
    }

    const orderNo = await this.generateUniqueOrderNo();

    let totalAmount = new Decimal(0);
    const orderItemValues: Array<{
      orderId?: string;
      productId: string;
      productName: string;
      productImage: string | null;
      unitPrice: string;
      quantity: number;
      subtotal: string;
    }> = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      const price = new Decimal(product.price as string);
      const subtotal = price.mul(item.quantity);
      totalAmount = totalAmount.plus(subtotal);
      orderItemValues.push({
        productId: product.id,
        productName: product.titleEn,
        productImage: product.coverImage,
        unitPrice: price.toFixed(2),
        quantity: item.quantity,
        subtotal: subtotal.toFixed(2),
      });
    }

    const totalAmountStr = totalAmount.toFixed(2);
    let couponId: string | null = null;
    let discountAmount = new Decimal(0);

    if (dto.couponCode?.trim()) {
      const validation = await this.couponsService.validate(
        dto.couponCode.trim(),
        totalAmountStr,
      );
      if (!validation.valid) {
        throw new BadRequestException(validation.message || '优惠券无效');
      }
      couponId = validation.coupon!.id;
      discountAmount = new Decimal(validation.discountAmount);
    }

    const finalAmount = totalAmount.minus(discountAmount);
    const finalAmountStr = finalAmount.toFixed(2);

    const result = await this.db.transaction(async (tx) => {
      const insertedOrders = await tx
        .insert(orders)
        .values({
          orderNo,
          userId: userId ?? null,
          buyerName,
          buyerEmail: dto.buyerEmail?.trim() ?? null,
          buyerPhone: dto.buyerPhone?.trim() ?? null,
          shippingAddress: dto.shippingAddress.trim(),
          shippingCity: dto.shippingCity.trim(),
          shippingZip: dto.shippingZip?.trim() ?? null,
          shippingCountry: dto.shippingCountry.trim(),
          totalAmount: finalAmountStr,
          status: 'pending_payment',
          paymentMethod: dto.paymentMethod?.trim() || 'demo',
          couponId: couponId,
          discountAmount: discountAmount.toFixed(2),
          remark: dto.remark?.trim() ?? null,
          sessionId: sessionId ?? null,
        })
        .returning();

      const newOrder = insertedOrders[0];

      await tx.insert(orderItems).values(
        orderItemValues.map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      );

      for (const item of dto.items) {
        const updated = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.quantity}`,
            sold: sql`${products.sold} + ${item.quantity}`,
          })
          .where(and(
            eq(products.id, item.productId),
            gte(products.stock, item.quantity),
          ))
          .returning({ id: products.id });

        if (updated.length === 0) {
          throw new ConflictException('库存不足，下单失败');
        }
      }

      if (couponId) {
        const couponUpdated = await tx
          .update(coupons)
          .set({ usedCount: sql`${coupons.usedCount} + 1` })
          .where(and(
            eq(coupons.id, couponId),
            lt(coupons.usedCount, coupons.totalQuantity),
            eq(coupons.active, true),
          ))
          .returning({ id: coupons.id });
        if (couponUpdated.length === 0) {
          throw new ConflictException('优惠券已用完或已停用');
        }
      }

       if (userId) {
         await tx.delete(cartItems).where(eq(cartItems.userId, userId));
       } else if (sessionId) {
         await tx.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
       }

      return newOrder;
    });

    const createdOrder = await this.getOrderDetail(result.id, userId, sessionId, false);

    // Audit log for order creation
    try {
      void this.auditService.log({
        action: 'order.create',
        entity: 'order',
        entityId: orderNo,
        after: {
          totalAmount: createdOrder.totalAmount,
          status: createdOrder.status,
          itemsCount: createdOrder.items.length,
        },
        userId: userId,
        role: userId ? 'buyer' : undefined,
        ip: auditMeta?.ip,
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    // Audit log for coupon redemption
    if (couponId) {
      try {
        void this.auditService.log({
          action: 'coupon.redeem',
          entity: 'coupon',
          entityId: couponId,
          after: {
            orderId: result.id,
          },
          userId: userId,
          role: userId ? 'buyer' : undefined,
          ip: auditMeta?.ip,
        });
      } catch {
        // Audit log failure must not affect main flow
      }
    }

    return createdOrder;
  }

  async updateStatus(
    id: string,
    dto: OrderStatusUpdateRequest,
    userId?: string,
    role?: string,
    ip?: string,
  ): Promise<Order> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, id));
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const currentOrder = orderRows[0];
    const currentStatus = currentOrder.status as OrderStatus;
    const newStatus = dto.status;
    const orderNo = currentOrder.orderNo;

    if (!STATUS_ORDER.includes(newStatus)) {
      throw new BadRequestException(`无效的订单状态: ${newStatus}`);
    }

    if (newStatus === 'cancelled') {
      if (currentStatus !== 'pending_payment') {
        throw new BadRequestException('仅待付款订单可取消');
      }

      await this.db.transaction(async (tx) => {
        const items = await tx
          .select({
            productId: orderItems.productId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, id));

        for (const item of items) {
          if (!item.productId) continue;
          await tx
            .update(products)
            .set({
              stock: sql`${products.stock} + ${item.quantity}`,
              sold: sql`GREATEST(${products.sold} - ${item.quantity}, 0)`,
            })
            .where(eq(products.id, item.productId));
        }

        if (currentOrder.couponId) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` })
            .where(eq(coupons.id, currentOrder.couponId));
        }

        await tx
          .update(orders)
          .set({ status: 'cancelled' })
          .where(eq(orders.id, id));
      });

      const updatedOrder = await this.getOrderDetail(id, undefined, undefined, true);

      // Audit log for status change
      try {
        void this.auditService.log({
          action: 'order.status_change',
          entity: 'order',
          entityId: orderNo,
          before: { oldStatus: currentStatus },
          after: { newStatus },
          userId,
          role,
          ip,
        });
      } catch {
        // Audit log failure must not affect main flow
      }

      return updatedOrder;
    }

    const updateData: Partial<typeof orders.$inferInsert> = {
      status: newStatus,
    };

    const now = new Date();
    if (newStatus === 'paid') {
      updateData.paidAt = now;
    } else if (newStatus === 'shipped') {
      updateData.shippedAt = now;
      if (dto.trackingNo !== undefined) {
        updateData.trackingNo = dto.trackingNo;
      }
    } else if (newStatus === 'delivered') {
      updateData.deliveredAt = now;
    }

    await this.db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id));

    const updatedOrder = await this.getOrderDetail(id, undefined, undefined, true);

    // Audit log for status change
    try {
      void this.auditService.log({
        action: 'order.status_change',
        entity: 'order',
        entityId: orderNo,
        before: { oldStatus: currentStatus },
        after: { newStatus },
        userId,
        role,
        ip,
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return updatedOrder;
  }
}
