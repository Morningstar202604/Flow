"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const decimal_js_1 = require("decimal.js");
const nanoid_1 = require("nanoid");
const schema_1 = require("@server/database/schema");
const coupons_service_1 = require("../coupons/coupons.service");
const audit_service_1 = require("../audit/audit.service");
const STATUS_ORDER = ['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled'];
let OrdersService = OrdersService_1 = class OrdersService {
    db;
    couponsService;
    auditService;
    logger = new common_1.Logger(OrdersService_1.name);
    constructor(db, couponsService, auditService) {
        this.db = db;
        this.couponsService = couponsService;
        this.auditService = auditService;
    }
    generateOrderNo() {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const rand = (0, nanoid_1.nanoid)(10).toUpperCase();
        return `ORD${dateStr}${rand}`;
    }
    async generateUniqueOrderNo() {
        for (let i = 0; i < 5; i += 1) {
            const orderNo = this.generateOrderNo();
            const existing = await this.db
                .select({ id: schema_1.orders.id })
                .from(schema_1.orders)
                .where((0, drizzle_orm_1.eq)(schema_1.orders.orderNo, orderNo));
            if (existing.length === 0)
                return orderNo;
        }
        throw new common_1.ConflictException('生成订单号失败，请重试');
    }
    mapOrderItem(row) {
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
    mapOrder(orderRow, items) {
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
            status: orderRow.status,
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
    async getOrderList(page, pageSize, status, keyword) {
        const whereConditions = [];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.orders.status, status));
        }
        if (keyword && keyword.trim()) {
            const kw = `%${keyword.trim()}%`;
            whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.orders.orderNo, kw), (0, drizzle_orm_1.ilike)(schema_1.orders.userId, kw)));
        }
        const whereClause = whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined;
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.orders)
            .where(whereClause);
        const total = Number(countResult[0]?.count ?? 0);
        const offset = (page - 1) * pageSize;
        const orderRows = await this.db
            .select()
            .from(schema_1.orders)
            .where(whereClause)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.orders.createdAt))
            .limit(pageSize)
            .offset(offset);
        if (orderRows.length === 0) {
            return { items: [], total, page, pageSize };
        }
        const orderIds = orderRows.map((o) => o.id);
        const itemRows = await this.db
            .select()
            .from(schema_1.orderItems)
            .where((0, drizzle_orm_1.inArray)(schema_1.orderItems.orderId, orderIds));
        const itemsByOrder = new Map();
        for (const row of itemRows) {
            const item = this.mapOrderItem({
                id: row.id,
                productId: row.productId,
                productTitle: row.productTitle,
                productImage: row.productImage,
                price: row.price,
                quantity: row.quantity,
                subtotal: row.subtotal,
            });
            const arr = itemsByOrder.get(row.orderId) ?? [];
            arr.push(item);
            itemsByOrder.set(row.orderId, arr);
        }
        const items = orderRows.map((row) => this.mapOrder({
            id: row.id,
            orderNo: row.orderNo,
            userId: row.userId,
            buyerEmail: row.buyerEmail,
            buyerPhone: row.buyerPhone,
            shippingAddress: row.shippingAddress,
            shippingCity: row.shippingCity,
            shippingZip: row.shippingZip,
            shippingCountry: row.shippingCountry,
            totalAmount: row.totalAmount,
            status: row.status,
            paymentMethod: row.paymentMethod,
            paidAt: row.paidAt,
            shippedAt: row.shippedAt,
            deliveredAt: row.deliveredAt,
            trackingNo: row.trackingNo,
            remark: row.remark,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }, itemsByOrder.get(row.id) ?? []));
        return { items, total, page, pageSize };
    }
    async getBuyerOrders(userId, sessionId, page, pageSize) {
        let whereClause;
        if (userId) {
            whereClause = (0, drizzle_orm_1.eq)(schema_1.orders.userId, userId);
        }
        else if (sessionId) {
            whereClause = (0, drizzle_orm_1.eq)(schema_1.orders.sessionId, sessionId);
        }
        else {
            return { items: [], total: 0, page, pageSize };
        }
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.orders)
            .where(whereClause);
        const total = Number(countResult[0]?.count ?? 0);
        const offset = (page - 1) * pageSize;
        const orderRows = await this.db
            .select()
            .from(schema_1.orders)
            .where(whereClause)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.orders.createdAt))
            .limit(pageSize)
            .offset(offset);
        if (orderRows.length === 0) {
            return { items: [], total, page, pageSize };
        }
        const orderIds = orderRows.map((o) => o.id);
        const itemRows = await this.db
            .select()
            .from(schema_1.orderItems)
            .where((0, drizzle_orm_1.inArray)(schema_1.orderItems.orderId, orderIds));
        const itemsByOrder = new Map();
        for (const row of itemRows) {
            const item = this.mapOrderItem({
                id: row.id,
                productId: row.productId,
                productTitle: row.productTitle,
                productImage: row.productImage,
                price: row.price,
                quantity: row.quantity,
                subtotal: row.subtotal,
            });
            const arr = itemsByOrder.get(row.orderId) ?? [];
            arr.push(item);
            itemsByOrder.set(row.orderId, arr);
        }
        const items = orderRows.map((row) => this.mapOrder({
            id: row.id,
            orderNo: row.orderNo,
            userId: row.userId,
            buyerEmail: row.buyerEmail,
            buyerPhone: row.buyerPhone,
            shippingAddress: row.shippingAddress,
            shippingCity: row.shippingCity,
            shippingZip: row.shippingZip,
            shippingCountry: row.shippingCountry,
            totalAmount: row.totalAmount,
            status: row.status,
            paymentMethod: row.paymentMethod,
            paidAt: row.paidAt,
            shippedAt: row.shippedAt,
            deliveredAt: row.deliveredAt,
            trackingNo: row.trackingNo,
            remark: row.remark,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }, itemsByOrder.get(row.id) ?? []));
        return { items, total, page, pageSize };
    }
    async getOrderDetail(id, userId, sessionId, isSeller = false) {
        const orderRows = await this.db.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.id, id));
        if (orderRows.length === 0) {
            throw new common_1.NotFoundException('订单不存在');
        }
        const orderRow = orderRows[0];
        if (!isSeller) {
            const isOwner = (userId && orderRow.userId && orderRow.userId === userId)
                || (sessionId && orderRow.sessionId && orderRow.sessionId === sessionId);
            if (!isOwner) {
                throw new common_1.ForbiddenException('无权访问该订单');
            }
        }
        const itemRows = await this.db
            .select()
            .from(schema_1.orderItems)
            .where((0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, id))
            .orderBy(schema_1.orderItems.createdAt);
        const items = itemRows.map((row) => this.mapOrderItem({
            id: row.id,
            productId: row.productId,
            productTitle: row.productTitle,
            productImage: row.productImage,
            price: row.price,
            quantity: row.quantity,
            subtotal: row.subtotal,
        }));
        return this.mapOrder({
            id: orderRow.id,
            orderNo: orderRow.orderNo,
            userId: orderRow.userId,
            buyerEmail: orderRow.buyerEmail,
            buyerPhone: orderRow.buyerPhone,
            shippingAddress: orderRow.shippingAddress,
            shippingCity: orderRow.shippingCity,
            shippingZip: orderRow.shippingZip,
            shippingCountry: orderRow.shippingCountry,
            totalAmount: orderRow.totalAmount,
            status: orderRow.status,
            paymentMethod: orderRow.paymentMethod,
            paidAt: orderRow.paidAt,
            shippedAt: orderRow.shippedAt,
            deliveredAt: orderRow.deliveredAt,
            trackingNo: orderRow.trackingNo,
            remark: orderRow.remark,
            createdAt: orderRow.createdAt,
            updatedAt: orderRow.updatedAt,
        }, items);
    }
    async createOrder(dto, userId, sessionId, auditMeta) {
        if (!dto.items || dto.items.length === 0) {
            throw new common_1.BadRequestException('订单商品不能为空');
        }
        const buyerName = dto.buyerName?.trim();
        if (!buyerName) {
            throw new common_1.BadRequestException('收货人姓名不能为空');
        }
        if (buyerName.length > 100) {
            throw new common_1.BadRequestException('收货人姓名不能超过 100 个字符');
        }
        const shippingAddress = dto.shippingAddress?.trim();
        if (!shippingAddress) {
            throw new common_1.BadRequestException('收货地址不能为空');
        }
        if (shippingAddress.length > 500) {
            throw new common_1.BadRequestException('收货地址不能超过 500 个字符');
        }
        const shippingCity = dto.shippingCity?.trim();
        if (!shippingCity) {
            throw new common_1.BadRequestException('城市不能为空');
        }
        if (shippingCity.length > 100) {
            throw new common_1.BadRequestException('城市不能超过 100 个字符');
        }
        const shippingCountry = dto.shippingCountry?.trim();
        if (!shippingCountry) {
            throw new common_1.BadRequestException('国家不能为空');
        }
        if (shippingCountry.length > 100) {
            throw new common_1.BadRequestException('国家不能超过 100 个字符');
        }
        if (dto.buyerEmail && dto.buyerEmail.trim()) {
            const email = dto.buyerEmail.trim();
            if (email.length > 255) {
                throw new common_1.BadRequestException('邮箱不能超过 255 个字符');
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new common_1.BadRequestException('邮箱格式不正确');
            }
        }
        if (dto.buyerPhone && dto.buyerPhone.trim()) {
            const phone = dto.buyerPhone.trim();
            if (phone.length > 50) {
                throw new common_1.BadRequestException('手机号不能超过 50 个字符');
            }
            const phoneRegex = /^[+]?[\d\s\-()]{6,50}$/;
            if (!phoneRegex.test(phone)) {
                throw new common_1.BadRequestException('手机号格式不正确');
            }
        }
        if (dto.shippingZip && dto.shippingZip.trim()) {
            const zip = dto.shippingZip.trim();
            if (zip.length > 20) {
                throw new common_1.BadRequestException('邮编不能超过 20 个字符');
            }
            const zipRegex = /^[\d\w\s\-]{3,20}$/;
            if (!zipRegex.test(zip)) {
                throw new common_1.BadRequestException('邮编格式不正确');
            }
        }
        if (dto.remark && dto.remark.length > 500) {
            throw new common_1.BadRequestException('备注不能超过 500 个字符');
        }
        const validPaymentMethods = new Set(['demo', 'stripe', 'paypal']);
        if (!validPaymentMethods.has(dto.paymentMethod)) {
            throw new common_1.BadRequestException('无效的支付方式');
        }
        const productIds = [...new Set(dto.items.map((item) => item.productId))];
        const productRows = await this.db
            .select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.inArray)(schema_1.products.id, productIds));
        if (productRows.length !== productIds.length) {
            throw new common_1.BadRequestException('部分商品不存在');
        }
        const productMap = new Map(productRows.map((p) => [p.id, p]));
        for (const item of dto.items) {
            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                throw new common_1.BadRequestException('商品数量必须是正整数');
            }
            const product = productMap.get(item.productId);
            if (!product) {
                throw new common_1.BadRequestException('商品不存在');
            }
            if (product.status !== 'active') {
                throw new common_1.BadRequestException(`商品 ${product.titleEn} 已下架`);
            }
            if (product.stock < item.quantity) {
                throw new common_1.BadRequestException(`商品 ${product.titleEn} 库存不足`);
            }
        }
        const orderNo = await this.generateUniqueOrderNo();
        let totalAmount = new decimal_js_1.Decimal(0);
        const orderItemValues = [];
        for (const item of dto.items) {
            const product = productMap.get(item.productId);
            const price = new decimal_js_1.Decimal(product.price);
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
        let couponId = null;
        let discountAmount = new decimal_js_1.Decimal(0);
        if (dto.couponCode?.trim()) {
            const validation = await this.couponsService.validate(dto.couponCode.trim(), totalAmountStr);
            if (!validation.valid) {
                throw new common_1.BadRequestException(validation.message || '优惠券无效');
            }
            couponId = validation.coupon.id;
            discountAmount = new decimal_js_1.Decimal(validation.discountAmount);
        }
        const finalAmount = totalAmount.minus(discountAmount);
        const finalAmountStr = finalAmount.toFixed(2);
        const result = await this.db.transaction(async (tx) => {
            const insertedOrders = await tx
                .insert(schema_1.orders)
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
            await tx.insert(schema_1.orderItems).values(orderItemValues.map((item) => ({
                orderId: newOrder.id,
                productId: item.productId,
                productName: item.productName,
                productImage: item.productImage,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                subtotal: item.subtotal,
            })));
            for (const item of dto.items) {
                const updated = await tx
                    .update(schema_1.products)
                    .set({
                    stock: (0, drizzle_orm_1.sql) `${schema_1.products.stock} - ${item.quantity}`,
                    sold: (0, drizzle_orm_1.sql) `${schema_1.products.sold} + ${item.quantity}`,
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.id, item.productId), (0, drizzle_orm_1.gte)(schema_1.products.stock, item.quantity)))
                    .returning({ id: schema_1.products.id });
                if (updated.length === 0) {
                    throw new common_1.ConflictException('库存不足，下单失败');
                }
            }
            if (couponId) {
                const couponUpdated = await tx
                    .update(schema_1.coupons)
                    .set({ usedCount: (0, drizzle_orm_1.sql) `${schema_1.coupons.usedCount} + 1` })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.coupons.id, couponId), (0, drizzle_orm_1.lt)(schema_1.coupons.usedCount, schema_1.coupons.totalQuantity), (0, drizzle_orm_1.eq)(schema_1.coupons.active, true)))
                    .returning({ id: schema_1.coupons.id });
                if (couponUpdated.length === 0) {
                    throw new common_1.ConflictException('优惠券已用完或已停用');
                }
            }
            if (userId) {
                await tx.delete(schema_1.cartItems).where((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId));
            }
            else if (sessionId) {
                await tx.delete(schema_1.cartItems).where((0, drizzle_orm_1.eq)(schema_1.cartItems.sessionId, sessionId));
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
        }
        catch {
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
            }
            catch {
                // Audit log failure must not affect main flow
            }
        }
        return createdOrder;
    }
    async updateStatus(id, dto, userId, role, ip) {
        const orderRows = await this.db.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.id, id));
        if (orderRows.length === 0) {
            throw new common_1.NotFoundException('订单不存在');
        }
        const currentOrder = orderRows[0];
        const currentStatus = currentOrder.status;
        const newStatus = dto.status;
        const orderNo = currentOrder.orderNo;
        if (!STATUS_ORDER.includes(newStatus)) {
            throw new common_1.BadRequestException(`无效的订单状态: ${newStatus}`);
        }
        if (newStatus === 'cancelled') {
            if (currentStatus !== 'pending_payment') {
                throw new common_1.BadRequestException('仅待付款订单可取消');
            }
            await this.db.transaction(async (tx) => {
                const items = await tx
                    .select({
                    productId: schema_1.orderItems.productId,
                    quantity: schema_1.orderItems.quantity,
                })
                    .from(schema_1.orderItems)
                    .where((0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, id));
                for (const item of items) {
                    if (!item.productId)
                        continue;
                    await tx
                        .update(schema_1.products)
                        .set({
                        stock: (0, drizzle_orm_1.sql) `${schema_1.products.stock} + ${item.quantity}`,
                        sold: (0, drizzle_orm_1.sql) `GREATEST(${schema_1.products.sold} - ${item.quantity}, 0)`,
                    })
                        .where((0, drizzle_orm_1.eq)(schema_1.products.id, item.productId));
                }
                if (currentOrder.couponId) {
                    await tx
                        .update(schema_1.coupons)
                        .set({ usedCount: (0, drizzle_orm_1.sql) `GREATEST(${schema_1.coupons.usedCount} - 1, 0)` })
                        .where((0, drizzle_orm_1.eq)(schema_1.coupons.id, currentOrder.couponId));
                }
                await tx
                    .update(schema_1.orders)
                    .set({ status: 'cancelled' })
                    .where((0, drizzle_orm_1.eq)(schema_1.orders.id, id));
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
            }
            catch {
                // Audit log failure must not affect main flow
            }
            return updatedOrder;
        }
        const updateData = {
            status: newStatus,
        };
        const now = new Date();
        if (newStatus === 'paid') {
            updateData.paidAt = now;
        }
        else if (newStatus === 'shipped') {
            updateData.shippedAt = now;
            if (dto.trackingNo !== undefined) {
                updateData.trackingNo = dto.trackingNo;
            }
        }
        else if (newStatus === 'delivered') {
            updateData.deliveredAt = now;
        }
        await this.db
            .update(schema_1.orders)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, id));
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
        }
        catch {
            // Audit log failure must not affect main flow
        }
        return updatedOrder;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, coupons_service_1.CouponsService,
        audit_service_1.AuditService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map