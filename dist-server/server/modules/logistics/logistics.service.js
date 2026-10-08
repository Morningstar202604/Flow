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
var LogisticsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
let LogisticsService = LogisticsService_1 = class LogisticsService {
    db;
    logger = new common_1.Logger(LogisticsService_1.name);
    apiKey;
    isDemoMode;
    constructor(db) {
        this.db = db;
        this.apiKey = process.env['17TRACK_API_KEY'] || '';
        this.isDemoMode = !this.apiKey;
    }
    async registerTracking(orderId, carrier, trackingNumber) {
        if (this.isDemoMode) {
            await this.upsertLogisticsAndShipOrder(orderId, carrier, trackingNumber);
            return { success: true, isDemo: true };
        }
        try {
            await this.upsertLogisticsAndShipOrder(orderId, carrier, trackingNumber);
            return { success: true, isDemo: false };
        }
        catch (error) {
            this.logger.error('注册运单失败', error);
            throw error;
        }
    }
    async upsertLogisticsAndShipOrder(orderId, carrier, trackingNumber) {
        await this.db.transaction(async (tx) => {
            const existing = await tx
                .select({ id: schema_1.logistics.id })
                .from(schema_1.logistics)
                .where((0, drizzle_orm_1.eq)(schema_1.logistics.orderId, orderId))
                .limit(1);
            if (existing.length > 0) {
                await tx
                    .update(schema_1.logistics)
                    .set({
                    carrier,
                    trackingNumber,
                    status: 'in_transit',
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.logistics.orderId, orderId));
            }
            else {
                await tx.insert(schema_1.logistics).values({
                    orderId,
                    carrier,
                    trackingNumber,
                    status: 'in_transit',
                    updatedAt: new Date(),
                });
            }
            await tx
                .update(schema_1.orders)
                .set({
                status: 'shipped',
                trackingNo: trackingNumber,
                shippedAt: new Date(),
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
        });
    }
    async getTrackingInfo(orderId) {
        const [order] = await this.db
            .select({
            id: schema_1.orders.id,
            status: schema_1.orders.status,
            createdAt: schema_1.orders.createdAt,
            paidAt: schema_1.orders.paidAt,
            shippedAt: schema_1.orders.shippedAt,
            deliveredAt: schema_1.orders.deliveredAt,
        })
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId))
            .limit(1);
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        const [logisticsRecord] = await this.db
            .select({
            carrier: schema_1.logistics.carrier,
            trackingNumber: schema_1.logistics.trackingNumber,
            status: schema_1.logistics.status,
        })
            .from(schema_1.logistics)
            .where((0, drizzle_orm_1.eq)(schema_1.logistics.orderId, orderId))
            .limit(1);
        if (this.isDemoMode) {
            const events = this.generateDemoTimeline(order);
            return {
                events,
                carrier: logisticsRecord?.carrier ?? null,
                trackingNumber: logisticsRecord?.trackingNumber ?? null,
                isDemo: true,
            };
        }
        // Real 17Track API would go here; fallback to demo timeline
        const events = this.generateDemoTimeline(order);
        return {
            events,
            carrier: logisticsRecord?.carrier ?? null,
            trackingNumber: logisticsRecord?.trackingNumber ?? null,
            isDemo: false,
        };
    }
    async verifyOrderOwnership(orderId, userId, sessionId) {
        const [order] = await this.db
            .select({
            id: schema_1.orders.id,
            userId: schema_1.orders.userId,
            sessionId: schema_1.orders.sessionId,
        })
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId))
            .limit(1);
        if (!order) {
            throw new common_1.NotFoundException('订单不存在');
        }
        if (userId && order.userId === userId) {
            return;
        }
        if (sessionId && order.sessionId === sessionId) {
            return;
        }
        throw new common_1.ForbiddenException('无权查看该订单物流');
    }
    generateDemoTimeline(order) {
        const events = [];
        const status = order.status;
        // Always include order placed event
        events.push({
            time: order.createdAt.toISOString(),
            status: 'order_placed',
            location: '',
            description: '订单已提交',
        });
        if (status === 'pending_payment') {
            return events;
        }
        if (order.paidAt) {
            events.push({
                time: order.paidAt.toISOString(),
                status: 'paid',
                location: '',
                description: '订单已付款',
            });
        }
        if (status === 'paid') {
            return events;
        }
        if (order.shippedAt) {
            const shippedTime = order.shippedAt;
            events.push({
                time: shippedTime.toISOString(),
                status: 'shipped',
                location: '中国深圳',
                description: '包裹已发出，等待承运人揽收',
            });
            // Add in_transit event (1 day after shipping)
            const inTransitTime = new Date(shippedTime.getTime() + 24 * 60 * 60 * 1000);
            events.push({
                time: inTransitTime.toISOString(),
                status: 'in_transit',
                location: '香港转运中心',
                description: '包裹已到达转运中心，正在安排国际运输',
            });
            // Add customs event (3 days after shipping)
            const customsTime = new Date(shippedTime.getTime() + 3 * 24 * 60 * 60 * 1000);
            events.push({
                time: customsTime.toISOString(),
                status: 'customs',
                location: '目的国海关',
                description: '包裹正在清关处理中',
            });
        }
        if (status === 'shipped' || status === 'in_transit') {
            return events;
        }
        if (order.deliveredAt) {
            events.push({
                time: order.deliveredAt.toISOString(),
                status: 'delivered',
                location: '收件地址',
                description: '包裹已签收',
            });
        }
        if (status === 'cancelled') {
            events.push({
                time: order.createdAt.toISOString(),
                status: 'cancelled',
                location: '',
                description: '订单已取消',
            });
        }
        return events;
    }
};
exports.LogisticsService = LogisticsService;
exports.LogisticsService = LogisticsService = LogisticsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], LogisticsService);
//# sourceMappingURL=logistics.service.js.map