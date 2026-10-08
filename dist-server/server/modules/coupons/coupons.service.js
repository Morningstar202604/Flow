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
var CouponsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponsService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const decimal_js_1 = require("decimal.js");
const schema_1 = require("@server/database/schema");
const audit_service_1 = require("../audit/audit.service");
let CouponsService = CouponsService_1 = class CouponsService {
    db;
    auditService;
    logger = new common_1.Logger(CouponsService_1.name);
    constructor(db, auditService) {
        this.db = db;
        this.auditService = auditService;
    }
    mapCoupon(row) {
        return {
            id: row.id,
            code: row.code,
            type: row.type,
            value: row.value.toString(),
            minOrderAmount: row.minOrderAmount.toString(),
            totalQuantity: Number(row.totalQuantity),
            usedCount: Number(row.usedCount),
            expiresAt: row.expiresAt ? row.expiresAt.toISOString() : undefined,
            active: row.active,
            createdAt: row.createdAt.toISOString(),
        };
    }
    async list(page = 1, pageSize = 20) {
        const skip = (page - 1) * pageSize;
        const rows = await this.db
            .select()
            .from(schema_1.coupons)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.coupons.createdAt))
            .limit(pageSize)
            .offset(skip);
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.coupons);
        return {
            items: rows.map((row) => this.mapCoupon(row)),
            total: Number(countResult[0]?.count ?? 0),
            page,
            pageSize,
        };
    }
    async create(dto, auditMeta) {
        if (!dto.code?.trim()) {
            throw new common_1.BadRequestException('优惠码不能为空');
        }
        if (!dto.value || dto.value <= 0) {
            throw new common_1.BadRequestException('面额必须大于 0');
        }
        if (dto.type === 'percent' && dto.value > 100) {
            throw new common_1.BadRequestException('百分比折扣不能超过 100');
        }
        const existing = await this.db
            .select({ id: schema_1.coupons.id })
            .from(schema_1.coupons)
            .where((0, drizzle_orm_1.eq)(schema_1.coupons.code, dto.code.trim().toUpperCase()));
        if (existing.length > 0) {
            throw new common_1.ConflictException('优惠码已存在');
        }
        const inserted = await this.db
            .insert(schema_1.coupons)
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
        }
        catch {
            // Audit log failure must not affect main flow
        }
        return coupon;
    }
    async update(id, dto) {
        const rows = await this.db.select().from(schema_1.coupons).where((0, drizzle_orm_1.eq)(schema_1.coupons.id, id));
        if (rows.length === 0) {
            throw new common_1.NotFoundException('优惠券不存在');
        }
        const patch = {};
        if (dto.code !== undefined) {
            const code = dto.code.trim().toUpperCase();
            const dup = await this.db
                .select({ id: schema_1.coupons.id })
                .from(schema_1.coupons)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.coupons.code, code), (0, drizzle_orm_1.eq)(schema_1.coupons.id, id)));
            if (dup.length > 0 && dup[0].id !== id) {
                throw new common_1.ConflictException('优惠码已存在');
            }
            patch.code = code;
        }
        if (dto.type !== undefined)
            patch.type = dto.type;
        if (dto.value !== undefined)
            patch.value = dto.value.toString();
        if (dto.minOrderAmount !== undefined)
            patch.minOrderAmount = dto.minOrderAmount.toString();
        if (dto.totalQuantity !== undefined)
            patch.totalQuantity = dto.totalQuantity;
        if (dto.expiresAt !== undefined) {
            patch.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
        }
        if (dto.active !== undefined)
            patch.active = dto.active;
        if (Object.keys(patch).length === 0) {
            return this.mapCoupon(rows[0]);
        }
        const updated = await this.db
            .update(schema_1.coupons)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(schema_1.coupons.id, id))
            .returning();
        return this.mapCoupon(updated[0]);
    }
    async validate(code, orderAmountStr) {
        if (!code?.trim()) {
            return {
                valid: false,
                discountAmount: 0,
                finalAmount: Number(orderAmountStr),
                message: '请输入优惠码',
            };
        }
        const orderAmount = new decimal_js_1.Decimal(orderAmountStr);
        const rows = await this.db
            .select()
            .from(schema_1.coupons)
            .where((0, drizzle_orm_1.eq)(schema_1.coupons.code, code.trim().toUpperCase()));
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
        const minOrderAmount = new decimal_js_1.Decimal(coupon.minOrderAmount);
        if (orderAmount.lt(minOrderAmount)) {
            return {
                valid: false,
                discountAmount: 0,
                finalAmount: orderAmount.toNumber(),
                message: `订单金额需满 ¥${minOrderAmount.toFixed(2)} 才能使用`,
            };
        }
        let discountAmount;
        if (coupon.type === 'percent') {
            const value = new decimal_js_1.Decimal(coupon.value);
            discountAmount = orderAmount.mul(value).div(100).toDecimalPlaces(2, decimal_js_1.Decimal.ROUND_HALF_UP);
        }
        else {
            discountAmount = new decimal_js_1.Decimal(coupon.value);
        }
        if (discountAmount.gt(orderAmount)) {
            discountAmount = orderAmount;
        }
        const finalAmount = orderAmount.minus(discountAmount).toDecimalPlaces(2, decimal_js_1.Decimal.ROUND_HALF_UP);
        return {
            valid: true,
            coupon: this.mapCoupon(coupon),
            discountAmount: discountAmount.toNumber(),
            finalAmount: finalAmount.toNumber(),
        };
    }
    async getCouponByCode(code) {
        const rows = await this.db
            .select()
            .from(schema_1.coupons)
            .where((0, drizzle_orm_1.eq)(schema_1.coupons.code, code.trim().toUpperCase()));
        return rows[0] ?? null;
    }
    async incrementUsedCount(id, auditMeta) {
        await this.db
            .update(schema_1.coupons)
            .set({ usedCount: (0, drizzle_orm_1.sql) `${schema_1.coupons.usedCount} + 1` })
            .where((0, drizzle_orm_1.eq)(schema_1.coupons.id, id));
        // Audit log for coupon redemption
        try {
            const couponRows = await this.db
                .select({ code: schema_1.coupons.code, usedCount: schema_1.coupons.usedCount })
                .from(schema_1.coupons)
                .where((0, drizzle_orm_1.eq)(schema_1.coupons.id, id));
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
        }
        catch {
            // Audit log failure must not affect main flow
        }
    }
};
exports.CouponsService = CouponsService;
exports.CouponsService = CouponsService = CouponsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, audit_service_1.AuditService])
], CouponsService);
//# sourceMappingURL=coupons.service.js.map