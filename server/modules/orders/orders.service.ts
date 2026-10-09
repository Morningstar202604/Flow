import { Injectable, Inject, Logger, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc, count, ilike, or, inArray, sql, gte, lt } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { nanoid } from 'nanoid';

import {
  orders, orderItems, orderFulfillments, refunds, orderNotes,
  products, productVariants, cartItems, coupons,
} from '@server/database/schema';
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

/** Shape of the addressSnapshot JSON stored on the order */
interface AddressSnapshot {
  receiverName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country: string;
  zipCode?: string;
}

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
    variantId: string | null;
    productTitle: string;
    variantInfo: string | null;
    productSku: string | null;
    productImage: string | null;
    unitPrice: string;
    quantity: number;
    subtotal: string;
  }): OrderItem {
    return {
      id: row.id,
      productId: row.productId ?? undefined,
      variantId: row.variantId ?? undefined,
      productTitle: row.productTitle,
      variantInfo: row.variantInfo ?? undefined,
      productSku: row.productSku ?? undefined,
      productImage: row.productImage ?? undefined,
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      subtotal: row.subtotal,
    };
  }

  private parseAddressSnapshot(raw: string | null): AddressSnapshot | undefined {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as AddressSnapshot;
    } catch {
      return undefined;
    }
  }

  /** Build a tracking-number string aggregated from fulfillments */
  private aggregateTracking(row: { trackingNumber: string | null }, fulfillmentsRows: Array<{ carrier: string | null; trackingNumber: string | null }>): string | undefined {
    if (fulfillmentsRows.length === 0) return row.trackingNumber ?? undefined;
    const parts = fulfillmentsRows
      .filter((f) => f.trackingNumber)
      .map((f) => `${f.carrier ?? ''}:${f.trackingNumber}`);
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  private mapOrder(
    orderRow: {
      id: string;
      orderNo: string;
      userId: string;
      subtotal: string;
      shippingFee: string;
      discountAmount: string;
      taxAmount: string;
      totalAmount: string;
      status: string;
      couponId: string | null;
      couponCode: string | null;
      paymentMethod: string | null;
      addressSnapshot: string | null;
      carrier: string | null;
      trackingNumber: string | null;
      customerNote: string | null;
      paidAt: Date | null;
      shippedAt: Date | null;
      deliveredAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    items: OrderItem[],
    fulfillments: Array<{ carrier: string | null; trackingNumber: string | null }> = [],
  ): Order {
    const addr = this.parseAddressSnapshot(orderRow.addressSnapshot);
    const tracking = this.aggregateTracking(orderRow, fulfillments);

    return {
      id: orderRow.id,
      orderNo: orderRow.orderNo,
      userId: orderRow.userId,
      buyerName: addr?.receiverName ?? '',
      buyerEmail: undefined,
      buyerPhone: addr?.phone,
      shippingAddress: addr?.addressLine1 ?? '',
      shippingCity: addr?.city ?? '',
      shippingZip: addr?.zipCode,
      shippingCountry: addr?.country ?? '',
      subtotal: orderRow.subtotal as string,
      shippingFee: orderRow.shippingFee as string,
      discountAmount: orderRow.discountAmount as string,
      taxAmount: orderRow.taxAmount as string,
      totalAmount: orderRow.totalAmount as string,
      couponCode: orderRow.couponCode ?? undefined,
      status: orderRow.status as OrderStatus,
      paymentMethod: orderRow.paymentMethod ?? 'demo',
      paidAt: orderRow.paidAt ? orderRow.paidAt.toISOString() : undefined,
      shippedAt: orderRow.shippedAt ? orderRow.shippedAt.toISOString() : undefined,
      deliveredAt: orderRow.deliveredAt ? orderRow.deliveredAt.toISOString() : undefined,
      trackingNumber: tracking,
      customerNote: orderRow.customerNote ?? undefined,
      items,
      fulfillments: fulfillments.map((f) => ({
        carrier: f.carrier ?? undefined,
        trackingNumber: f.trackingNumber ?? undefined,
      })),
      createdAt: orderRow.createdAt.toISOString(),
      updatedAt: orderRow.updatedAt.toISOString(),
    };
  }

  private async loadOrderItems(orderIds: string[]): Promise<Map<string, OrderItem[]>> {
    if (orderIds.length === 0) return new Map();
    const itemRows = await this.db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const row of itemRows) {
      const item = this.mapOrderItem({
        id: row.id,
        productId: row.productId,
        variantId: row.variantId,
        productTitle: row.productTitle,
        variantInfo: row.variantInfo,
        productSku: row.productSku,
        productImage: row.productImage,
        unitPrice: row.unitPrice as string,
        quantity: row.quantity,
        subtotal: row.subtotal as string,
      });
      const arr = itemsByOrder.get(row.orderId) ?? [];
      arr.push(item);
      itemsByOrder.set(row.orderId, arr);
    }
    return itemsByOrder;
  }

  private async loadFulfillments(orderIds: string[]): Promise<Map<string, Array<{ carrier: string | null; trackingNumber: string | null }>>> {
    if (orderIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        orderId: orderFulfillments.orderId,
        carrier: orderFulfillments.carrier,
        trackingNumber: orderFulfillments.trackingNumber,
      })
      .from(orderFulfillments)
      .where(inArray(orderFulfillments.orderId, orderIds));

    const map = new Map<string, Array<{ carrier: string | null; trackingNumber: string | null }>>();
    for (const row of rows) {
      const arr = map.get(row.orderId) ?? [];
      arr.push({ carrier: row.carrier, trackingNumber: row.trackingNumber });
      map.set(row.orderId, arr);
    }
    return map;
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
    const itemsByOrder = await this.loadOrderItems(orderIds);
    const fulfillmentsByOrder = await this.loadFulfillments(orderIds);

    const items = orderRows.map((row) => this.mapOrder(
      {
        id: row.id,
        orderNo: row.orderNo,
        userId: row.userId,
        subtotal: row.subtotal as string,
        shippingFee: row.shippingFee as string,
        discountAmount: row.discountAmount as string,
        taxAmount: row.taxAmount as string,
        totalAmount: row.totalAmount as string,
        status: row.status,
        couponId: row.couponId,
        couponCode: row.couponCode,
        paymentMethod: row.paymentMethod,
        addressSnapshot: row.addressSnapshot,
        carrier: row.carrier,
        trackingNumber: row.trackingNumber,
        customerNote: row.customerNote,
        paidAt: row.paidAt,
        shippedAt: row.shippedAt,
        deliveredAt: row.deliveredAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      itemsByOrder.get(row.id) ?? [],
      fulfillmentsByOrder.get(row.id) ?? [],
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
      // Guest orders stored in addressSnapshot with a sessionId lookup is no longer supported
      // Fall back to returning empty for guest sessions
      return { items: [], total: 0, page, pageSize };
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
    const itemsByOrder = await this.loadOrderItems(orderIds);
    const fulfillmentsByOrder = await this.loadFulfillments(orderIds);

    const items = orderRows.map((row) => this.mapOrder(
      {
        id: row.id,
        orderNo: row.orderNo,
        userId: row.userId,
        subtotal: row.subtotal as string,
        shippingFee: row.shippingFee as string,
        discountAmount: row.discountAmount as string,
        taxAmount: row.taxAmount as string,
        totalAmount: row.totalAmount as string,
        status: row.status,
        couponId: row.couponId,
        couponCode: row.couponCode,
        paymentMethod: row.paymentMethod,
        addressSnapshot: row.addressSnapshot,
        carrier: row.carrier,
        trackingNumber: row.trackingNumber,
        customerNote: row.customerNote,
        paidAt: row.paidAt,
        shippedAt: row.shippedAt,
        deliveredAt: row.deliveredAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      itemsByOrder.get(row.id) ?? [],
      fulfillmentsByOrder.get(row.id) ?? [],
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
      if (userId && orderRow.userId && orderRow.userId === userId) {
        // owner
      } else if (sessionId && orderRow.addressSnapshot) {
        // guest session lookup via addressSnapshot.sessionId (legacy compatibility)
        try {
          const snap = JSON.parse(orderRow.addressSnapshot) as { sessionId?: string };
          if (snap.sessionId !== sessionId) {
            throw new ForbiddenException('无权访问该订单');
          }
        } catch {
          throw new ForbiddenException('无权访问该订单');
        }
      } else {
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
      variantId: row.variantId,
      productTitle: row.productTitle,
      variantInfo: row.variantInfo,
      productSku: row.productSku,
      productImage: row.productImage,
      unitPrice: row.unitPrice as string,
      quantity: row.quantity,
      subtotal: row.subtotal as string,
    }));

    const fulfillments = await this.db
      .select({
        carrier: orderFulfillments.carrier,
        trackingNumber: orderFulfillments.trackingNumber,
      })
      .from(orderFulfillments)
      .where(eq(orderFulfillments.orderId, id));

    return this.mapOrder(
      {
        id: orderRow.id,
        orderNo: orderRow.orderNo,
        userId: orderRow.userId,
        subtotal: orderRow.subtotal as string,
        shippingFee: orderRow.shippingFee as string,
        discountAmount: orderRow.discountAmount as string,
        taxAmount: orderRow.taxAmount as string,
        totalAmount: orderRow.totalAmount as string,
        status: orderRow.status,
        couponId: orderRow.couponId,
        couponCode: orderRow.couponCode,
        paymentMethod: orderRow.paymentMethod,
        addressSnapshot: orderRow.addressSnapshot,
        carrier: orderRow.carrier,
        trackingNumber: orderRow.trackingNumber,
        customerNote: orderRow.customerNote,
        paidAt: orderRow.paidAt,
        shippedAt: orderRow.shippedAt,
        deliveredAt: orderRow.deliveredAt,
        createdAt: orderRow.createdAt,
        updatedAt: orderRow.updatedAt,
      },
      items,
      fulfillments.map((f) => ({ carrier: f.carrier, trackingNumber: f.trackingNumber })),
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

    const receiverName = dto.buyerName?.trim();
    if (!receiverName) {
      throw new BadRequestException('收货人姓名不能为空');
    }
    if (receiverName.length > 100) {
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

    if (dto.customerNote && dto.customerNote.length > 500) {
      throw new BadRequestException('备注不能超过 500 个字符');
    }

    const validPaymentMethods = new Set(['demo', 'stripe', 'paypal']);
    if (!validPaymentMethods.has(dto.paymentMethod)) {
      throw new BadRequestException('无效的支付方式');
    }

    // Resolve variant for each item (use provided variantId or first variant of product)
    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const productRows = await this.db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    if (productRows.length !== productIds.length) {
      throw new BadRequestException('部分商品不存在');
    }

    const productMap = new Map(productRows.map((p) => [p.id, p]));

    // Load all variants for these products
    const variantRows = await this.db
      .select()
      .from(productVariants)
      .where(inArray(productVariants.productId, productIds));

    const variantsByProduct = new Map<string, typeof variantRows>();
    for (const v of variantRows) {
      const arr = variantsByProduct.get(v.productId) ?? [];
      arr.push(v);
      variantsByProduct.set(v.productId, arr);
    }

    // Resolve variantId for each item
    const itemVariantIds: Array<{ itemId: string; variantId: string }> = [];
    for (const item of dto.items) {
      let variantId: string | undefined;
      if (item.variantId) {
        variantId = item.variantId;
      } else {
        const variants = variantsByProduct.get(item.productId) ?? [];
        const activeVariant = variants.find((v) => v.status === 'active');
        variantId = activeVariant?.id ?? variants[0]?.id;
      }
      if (!variantId) {
        const product = productMap.get(item.productId)!;
        throw new BadRequestException(`商品 ${product.titleEn} 没有可用的规格`);
      }
      itemVariantIds.push({ itemId: item.productId, variantId });
    }

    // Map variantId → variant row for quick lookup
    const variantMap = new Map(variantRows.map((v) => [v.id, v]));

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
      const entry = itemVariantIds.find((e) => e.itemId === item.productId);
      const variant = variantMap.get(entry!.variantId);
      if (!variant || variant.stock < item.quantity) {
        throw new BadRequestException(`商品 ${product.titleEn} 库存不足`);
      }
    }

    const orderNo = await this.generateUniqueOrderNo();

    let subtotal = new Decimal(0);
    const orderItemValues: Array<{
      productId: string;
      variantId: string;
      productTitle: string;
      variantInfo: string | null;
      productSku: string | null;
      productImage: string | null;
      unitPrice: string;
      quantity: number;
      subtotal: string;
    }> = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      const entry = itemVariantIds.find((e) => e.itemId === item.productId);
      const variant = variantMap.get(entry!.variantId)!;
      const unitPrice = new Decimal(variant.price as string);
      const itemSubtotal = unitPrice.mul(item.quantity);
      subtotal = subtotal.plus(itemSubtotal);
      orderItemValues.push({
        productId: product.id,
        variantId: variant.id,
        productTitle: product.titleEn,
        variantInfo: Array.isArray(variant.optionValues) ? variant.optionValues.join(' / ') : null,
        productSku: variant.sku,
        productImage: variant.image ?? product.coverImage,
        unitPrice: unitPrice.toFixed(2),
        quantity: item.quantity,
        subtotal: itemSubtotal.toFixed(2),
      });
    }

    const subtotalStr = subtotal.toFixed(2);
    const shippingFee = new Decimal(0);
    let couponId: string | null = null;
    let couponCode: string | null = null;
    let discountAmount = new Decimal(0);

    if (dto.couponCode?.trim()) {
      const validation = await this.couponsService.validate(
        dto.couponCode.trim(),
        subtotalStr,
        userId,
      );
      if (!validation.valid) {
        throw new BadRequestException(validation.message || '优惠券无效');
      }
      couponId = validation.coupon!.id;
      couponCode = validation.coupon!.code;
      discountAmount = new Decimal(validation.discountAmount);
    }

    const taxAmount = new Decimal(0);
    const totalAmount = subtotal.plus(shippingFee).minus(discountAmount).plus(taxAmount);
    const totalAmountStr = totalAmount.toFixed(2);

    // Build address snapshot
    const addressSnapshot: AddressSnapshot = {
      receiverName,
      phone: dto.buyerPhone?.trim() || undefined,
      addressLine1: dto.shippingAddress.trim(),
      addressLine2: undefined,
      city: dto.shippingCity.trim(),
      state: undefined,
      country: dto.shippingCountry.trim(),
      zipCode: dto.shippingZip?.trim() || undefined,
    };
    if (sessionId) {
      (addressSnapshot as unknown as Record<string, unknown>).sessionId = sessionId;
    }

    const result = await this.db.transaction(async (tx) => {
      const insertedOrders = await tx
        .insert(orders)
        .values({
          orderNo,
          userId: userId ?? null,
          subtotal: subtotalStr,
          shippingFee: shippingFee.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          totalAmount: totalAmountStr,
          status: 'pending_payment',
          paymentMethod: (dto.paymentMethod?.trim() || 'demo') as 'stripe' | 'paypal' | 'demo',
          couponId,
          couponCode,
          addressSnapshot: JSON.stringify(addressSnapshot),
          customerNote: dto.customerNote?.trim() ?? dto.remark?.trim() ?? null,
        })
        .returning();

      const newOrder = insertedOrders[0];

      await tx.insert(orderItems).values(
        orderItemValues.map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          variantId: item.variantId,
          productTitle: item.productTitle,
          variantInfo: item.variantInfo,
          productSku: item.productSku,
          productImage: item.productImage,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      );

      // Decrement variant stock and increment variant sold
      for (const item of dto.items) {
        const entry = itemVariantIds.find((e) => e.itemId === item.productId);
        const variantId = entry!.variantId;
        const updated = await tx
          .update(productVariants)
          .set({
            stock: sql`${productVariants.stock} - ${item.quantity}`,
            sold: sql`${productVariants.sold} + ${item.quantity}`,
          })
          .where(and(
            eq(productVariants.id, variantId),
            gte(productVariants.stock, item.quantity),
          ))
          .returning({ id: productVariants.id });

        if (updated.length === 0) {
          throw new ConflictException('库存不足，下单失败');
        }

        // Also update product-level aggregates (totalStock, totalSold)
        await tx
          .update(products)
          .set({
            totalStock: sql`${products.totalStock} - ${item.quantity}`,
            totalSold: sql`${products.totalSold} + ${item.quantity}`,
          })
          .where(eq(products.id, item.productId));
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
            variantId: orderItems.variantId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, id));

        for (const item of items) {
          if (item.variantId) {
            await tx
              .update(productVariants)
              .set({
                stock: sql`${productVariants.stock} + ${item.quantity}`,
                sold: sql`GREATEST(${productVariants.sold} - ${item.quantity}, 0)`,
              })
              .where(eq(productVariants.id, item.variantId));

            // Also update product-level aggregates
            if (item.productId) {
              await tx
                .update(products)
                .set({
                  totalStock: sql`${products.totalStock} + ${item.quantity}`,
                  totalSold: sql`GREATEST(${products.totalSold} - ${item.quantity}, 0)`,
                })
                .where(eq(products.id, item.productId));
            }
          }
        }

        if (currentOrder.couponId) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` })
            .where(eq(coupons.id, currentOrder.couponId));
        }

        await tx
          .update(orders)
          .set({ status: 'cancelled', cancelledAt: new Date() })
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
      if (dto.trackingNumber !== undefined) {
        updateData.trackingNumber = dto.trackingNumber;
        updateData.carrier = dto.carrier ?? null;
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

  // ==================== Refund Methods ====================

  async requestRefund(
    orderId: string,
    userId: string,
    dto: {
      reason: string;
      reasonDetail?: string;
      items?: Array<{ orderItemId: string; quantity: number }>;
      amount?: string;
    },
  ): Promise<{ id: string; refundNo: string; status: string }> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }
    const order = orderRows[0];

    if (order.userId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }

    if (!['paid', 'shipped', 'delivered'].includes(order.status)) {
      throw new BadRequestException('当前订单状态不可申请退款');
    }

    // Check for existing pending refund
    const existingRefunds = await this.db
      .select({ id: refunds.id })
      .from(refunds)
      .where(and(eq(refunds.orderId, orderId), eq(refunds.status, 'requested')));
    if (existingRefunds.length > 0) {
      throw new ConflictException('已有待处理的退款申请');
    }

    let refundAmount: Decimal;
    if (dto.amount) {
      refundAmount = new Decimal(dto.amount);
    } else if (dto.items && dto.items.length > 0) {
      // Calculate from specified items
      refundAmount = new Decimal(0);
      for (const refundItem of dto.items) {
        const itemRows = await this.db
          .select({ unitPrice: orderItems.unitPrice, quantity: orderItems.quantity })
          .from(orderItems)
          .where(and(eq(orderItems.id, refundItem.orderItemId), eq(orderItems.orderId, orderId)));
        if (itemRows.length === 0) continue;
        const item = itemRows[0];
        refundAmount = refundAmount.plus(new Decimal(item.unitPrice as string).mul(refundItem.quantity));
      }
    } else {
      refundAmount = new Decimal(order.totalAmount as string);
    }

    if (refundAmount.lte(0)) {
      throw new BadRequestException('退款金额必须大于 0');
    }

    const refundNo = `RF${Date.now().toString().toUpperCase()}${nanoid(6).toUpperCase()}`;

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
        refundMethod: 'original',
      })
      .returning();

    const refund = inserted[0];

    try {
      void this.auditService.log({
        action: 'refund.request',
        entity: 'refund',
        entityId: refund.id,
        after: { orderId, amount: refundAmount.toFixed(2), reason: dto.reason },
        userId,
        role: 'buyer',
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return { id: refund.id, refundNo: refund.refundNo, status: refund.status };
  }

  async approveRefund(
    refundId: string,
    sellerId: string,
    dto?: { sellerReply?: string },
  ): Promise<{ id: string; status: string }> {
    const refundRows = await this.db.select().from(refunds).where(eq(refunds.id, refundId));
    if (refundRows.length === 0) {
      throw new NotFoundException('退款记录不存在');
    }
    const refund = refundRows[0];

    if (refund.status !== 'requested') {
      throw new BadRequestException('仅待处理退款可审批');
    }

    const updated = await this.db
      .update(refunds)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        sellerReply: dto?.sellerReply ?? null,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refundId))
      .returning();

    try {
      void this.auditService.log({
        action: 'refund.approve',
        entity: 'refund',
        entityId: refundId,
        after: { status: 'approved' },
        userId: sellerId,
        role: 'seller',
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return { id: updated[0].id, status: updated[0].status };
  }

  async rejectRefund(
    refundId: string,
    sellerId: string,
    dto: { sellerReply: string },
  ): Promise<{ id: string; status: string }> {
    const refundRows = await this.db.select().from(refunds).where(eq(refunds.id, refundId));
    if (refundRows.length === 0) {
      throw new NotFoundException('退款记录不存在');
    }
    const refund = refundRows[0];

    if (refund.status !== 'requested') {
      throw new BadRequestException('仅待处理退款可拒绝');
    }

    // Restore stock if previously deducted (on approval)
    const orderId = refund.orderId;

    const updated = await this.db
      .update(refunds)
      .set({
        status: 'rejected',
        sellerReply: dto.sellerReply,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refundId))
      .returning();

    try {
      void this.auditService.log({
        action: 'refund.reject',
        entity: 'refund',
        entityId: refundId,
        before: { status: refund.status },
        after: { status: 'rejected', reply: dto.sellerReply },
        userId: sellerId,
        role: 'seller',
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    void orderId;

    return { id: updated[0].id, status: updated[0].status };
  }

  // ==================== Fulfillment Methods ====================

  async createFulfillment(
    orderId: string,
    sellerId: string,
    dto: {
      carrier: string;
      trackingNumber?: string;
      trackingUrl?: string;
      items?: Array<{ orderItemId: string; quantity: number }>;
    },
  ): Promise<{ id: string; status: string }> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }
    const order = orderRows[0];

    if (!['paid', 'shipped'].includes(order.status)) {
      throw new BadRequestException('订单状态不允许发货');
    }

    const inserted = await this.db
      .insert(orderFulfillments)
      .values({
        orderId,
        carrier: dto.carrier,
        trackingNumber: dto.trackingNumber ?? null,
        trackingUrl: dto.trackingUrl ?? null,
        status: 'shipped',
        shippedAt: new Date(),
      })
      .returning();

    const fulfillment = inserted[0];

    // If order is not yet shipped, update it
    if (order.status === 'paid') {
      await this.db
        .update(orders)
        .set({
          status: 'shipped',
          shippedAt: new Date(),
          carrier: dto.carrier,
          trackingNumber: dto.trackingNumber ?? order.trackingNumber,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }

    try {
      void this.auditService.log({
        action: 'order.fulfill',
        entity: 'order_fulfillment',
        entityId: fulfillment.id,
        after: { orderId, carrier: dto.carrier, trackingNumber: dto.trackingNumber },
        userId: sellerId,
        role: 'seller',
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return { id: fulfillment.id, status: fulfillment.status };
  }

  // ==================== Order Notes ====================

  async addOrderNote(
    orderId: string,
    authorId: string,
    dto: { content: string; type?: 'customer' | 'staff' },
  ): Promise<{ id: string; createdAt: string }> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    if (!dto.content?.trim()) {
      throw new BadRequestException('备注内容不能为空');
    }
    if (dto.content.length > 1000) {
      throw new BadRequestException('备注不能超过 1000 个字符');
    }

    const inserted = await this.db
      .insert(orderNotes)
      .values({
        orderId,
        authorId,
        content: dto.content.trim(),
        type: dto.type ?? 'staff',
      })
      .returning();

    const note = inserted[0];

    try {
      void this.auditService.log({
        action: 'order.note_add',
        entity: 'order_note',
        entityId: note.id,
        after: { orderId, type: note.type },
        userId: authorId,
        role: 'seller',
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return { id: note.id, createdAt: note.createdAt.toISOString() };
  }

  async getOrderNotes(orderId: string): Promise<Array<{
    id: string;
    authorId: string | null;
    content: string;
    type: string;
    createdAt: string;
  }>> {
    const rows = await this.db
      .select()
      .from(orderNotes)
      .where(eq(orderNotes.orderId, orderId))
      .orderBy(desc(orderNotes.createdAt));

    return rows.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      content: row.content,
      type: row.type,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
