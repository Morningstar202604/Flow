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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
const stripe_service_1 = require("./stripe.service");
const paypal_service_1 = require("./paypal.service");
const audit_service_1 = require("../audit/audit.service");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    db;
    stripeService;
    payPalService;
    auditService;
    logger = new common_1.Logger(PaymentsService_1.name);
    constructor(db, stripeService, payPalService, auditService) {
        this.db = db;
        this.stripeService = stripeService;
        this.payPalService = payPalService;
        this.auditService = auditService;
    }
    generateDemoTransactionId() {
        return `DEMO_${Date.now().toString()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    }
    mapPayment(row) {
        return {
            id: row.id,
            orderId: row.orderId,
            provider: row.provider,
            amount: row.amount,
            currency: row.currency,
            status: row.status,
            transactionId: row.transactionId ?? undefined,
            createdAt: row.createdAt.toISOString(),
        };
    }
    async pay(orderId, provider, userId, sessionId, auditMeta) {
        const orderRows = await this.db.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
        if (orderRows.length === 0) {
            throw new common_1.NotFoundException('订单不存在');
        }
        const order = orderRows[0];
        const isOwner = (userId && order.userId && order.userId === userId)
            || (sessionId && order.sessionId && order.sessionId === sessionId);
        if (!isOwner) {
            throw new common_1.ForbiddenException('无权支付该订单');
        }
        if (order.status === 'paid') {
            throw new common_1.BadRequestException('订单已支付');
        }
        if (order.status !== 'pending_payment') {
            throw new common_1.BadRequestException('当前订单状态无法支付');
        }
        const amount = Number(order.totalAmount);
        const currency = 'USD';
        if (provider === 'stripe' && this.stripeService.isConfigured()) {
            const { clientSecret, paymentIntentId } = await this.stripeService.createPaymentIntent(amount, currency, orderId);
            const paymentRow = await this.createPayment(orderId, 'stripe', amount, currency, 'pending', paymentIntentId);
            return {
                success: true,
                payment: this.mapPayment({
                    ...paymentRow,
                    createdAt: new Date(paymentRow.createdAt),
                }),
                message: 'Stripe payment intent created',
            };
        }
        if (provider === 'paypal' && this.payPalService.isConfigured()) {
            const { paypalOrderId, approveUrl } = await this.payPalService.createOrder(amount, currency, orderId);
            const paymentRow = await this.createPayment(orderId, 'paypal', amount, currency, 'pending', paypalOrderId);
            return {
                success: true,
                payment: this.mapPayment({
                    ...paymentRow,
                    createdAt: new Date(paymentRow.createdAt),
                }),
                message: approveUrl,
            };
        }
        return this.processDemoPayment(orderId, provider, amount, currency, order, auditMeta);
    }
    async processDemoPayment(orderId, provider, amount, currency, order, auditMeta) {
        const transactionId = this.generateDemoTransactionId();
        const result = await this.db.transaction(async (tx) => {
            const paymentRows = await tx
                .insert(schema_1.payments)
                .values({
                orderId,
                method: provider,
                provider,
                amount: amount.toString(),
                currency,
                status: 'paid',
                transactionId,
            })
                .returning();
            const now = new Date();
            const updatedOrders = await tx
                .update(schema_1.orders)
                .set({
                status: 'paid',
                paidAt: now,
                paymentMethod: provider,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId))
                .returning();
            return { payment: paymentRows[0], order: updatedOrders[0] };
        });
        this.logger.log(`Demo payment successful: order=${order.orderNo} provider=${provider} txn=${transactionId} amount=${amount}`);
        // Audit log for payment
        try {
            void this.auditService.log({
                action: 'payment.pay',
                entity: 'payment',
                entityId: result.payment.id,
                after: {
                    amount: result.payment.amount,
                    provider,
                    status: 'paid',
                },
                userId: order.userId ?? undefined,
                role: order.userId ? 'buyer' : undefined,
                ip: auditMeta?.ip,
            });
        }
        catch {
            // Audit log failure must not affect main flow
        }
        const updatedOrder = result.order;
        const items = await this.db
            .select()
            .from(schema_1.orderItems)
            .where((0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, orderId));
        const orderResponse = {
            id: updatedOrder.id,
            orderNo: updatedOrder.orderNo,
            userId: updatedOrder.userId,
            buyerName: updatedOrder.buyerName ?? '',
            buyerEmail: updatedOrder.buyerEmail ?? undefined,
            buyerPhone: updatedOrder.buyerPhone ?? undefined,
            shippingAddress: updatedOrder.shippingAddress,
            shippingCity: updatedOrder.shippingCity,
            shippingZip: updatedOrder.shippingZip ?? undefined,
            shippingCountry: updatedOrder.shippingCountry,
            totalAmount: updatedOrder.totalAmount,
            status: updatedOrder.status,
            paymentMethod: updatedOrder.paymentMethod ?? provider,
            paidAt: updatedOrder.paidAt?.toISOString(),
            shippedAt: updatedOrder.shippedAt?.toISOString(),
            deliveredAt: updatedOrder.deliveredAt?.toISOString(),
            trackingNo: updatedOrder.trackingNo ?? undefined,
            remark: updatedOrder.remark ?? undefined,
            items: items.map((item) => ({
                id: item.id,
                productId: item.productId ?? undefined,
                productTitle: item.productTitle,
                productImage: item.productImage ?? undefined,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.subtotal,
            })),
            createdAt: updatedOrder.createdAt.toISOString(),
            updatedAt: updatedOrder.updatedAt.toISOString(),
        };
        return {
            success: true,
            payment: this.mapPayment({
                ...result.payment,
                createdAt: new Date(result.payment.createdAt),
            }),
            order: orderResponse,
            demoMode: true,
            message: '演示支付成功',
        };
    }
    async createPayment(orderId, provider, amount, currency, status, transactionId) {
        const rows = await this.db
            .insert(schema_1.payments)
            .values({
            orderId,
            method: provider,
            provider,
            amount: amount.toString(),
            currency,
            status,
            transactionId,
        })
            .returning();
        return rows[0];
    }
    async getPaymentsByOrder(orderId, userId, sessionId, isSeller = false) {
        if (!isSeller) {
            const orderRows = await this.db.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
            if (orderRows.length === 0) {
                throw new common_1.NotFoundException('订单不存在');
            }
            const order = orderRows[0];
            const isOwner = (userId && order.userId && order.userId === userId)
                || (sessionId && order.sessionId && order.sessionId === sessionId);
            if (!isOwner) {
                throw new common_1.ForbiddenException('无权查看该订单的支付记录');
            }
        }
        const rows = await this.db
            .select()
            .from(schema_1.payments)
            .where((0, drizzle_orm_1.eq)(schema_1.payments.orderId, orderId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.payments.createdAt));
        return rows.map((row) => this.mapPayment({
            ...row,
            createdAt: new Date(row.createdAt),
        }));
    }
    async getPaymentConfig() {
        const stripeConfigured = this.stripeService.isConfigured();
        const paypalConfigured = this.payPalService.isConfigured();
        return {
            stripeConfigured,
            paypalConfigured,
            demoMode: !stripeConfigured && !paypalConfigured,
        };
    }
    async handlePayPalWebhook(headers, body) {
        const verified = await this.payPalService.verifyWebhook(headers, JSON.stringify(body));
        if (!verified) {
            return false;
        }
        const { eventType, data } = verified;
        if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
            this.logger.log(`PayPal webhook skipped: ${eventType}`);
            return true;
        }
        const orderId = data?.custom_id;
        const transactionId = data?.id;
        const amount = data?.amount?.value;
        const currency = data?.amount?.currency_code ?? 'USD';
        if (!orderId) {
            this.logger.warn('PayPal webhook rejected: missing custom_id (orderId)');
            return false;
        }
        try {
            await this.db.transaction(async (tx) => {
                await tx
                    .insert(schema_1.payments)
                    .values({
                    orderId,
                    method: 'paypal',
                    provider: 'paypal',
                    amount: amount?.toString() ?? '0',
                    currency,
                    status: 'paid',
                    transactionId: transactionId ?? null,
                });
                await tx
                    .update(schema_1.orders)
                    .set({
                    status: 'paid',
                    paidAt: new Date(),
                    paymentMethod: 'paypal',
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
            });
            return true;
        }
        catch (err) {
            this.logger.error('PayPal webhook order update failed', err.message);
            return false;
        }
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, stripe_service_1.StripeService,
        paypal_service_1.PayPalService,
        audit_service_1.AuditService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map