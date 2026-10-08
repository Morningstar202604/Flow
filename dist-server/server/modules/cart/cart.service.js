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
var CartService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
let CartService = CartService_1 = class CartService {
    db;
    logger = new common_1.Logger(CartService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getCart(userId, sessionId) {
        let whereCondition;
        if (userId) {
            whereCondition = (0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId);
        }
        else if (sessionId) {
            whereCondition = (0, drizzle_orm_1.eq)(schema_1.cartItems.sessionId, sessionId);
        }
        else {
            return { items: [], subtotal: '0.00', total: '0.00', itemCount: 0 };
        }
        const rows = await this.db
            .select({
            id: schema_1.cartItems.id,
            productId: schema_1.cartItems.productId,
            quantity: schema_1.cartItems.quantity,
            productTitleEn: schema_1.products.titleEn,
            productTitleZh: schema_1.products.titleZh,
            productPrice: schema_1.products.price,
            productCoverImage: schema_1.products.coverImage,
            productStatus: schema_1.products.status,
            productStock: schema_1.products.stock,
            productImages: schema_1.products.images,
        })
            .from(schema_1.cartItems)
            .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.cartItems.productId, schema_1.products.id))
            .where(whereCondition)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.cartItems.createdAt));
        const items = rows.map((row) => ({
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
                price: row.productPrice,
                stock: row.productStock,
                sold: 0,
                status: row.productStatus,
                coverImage: row.productCoverImage ?? undefined,
                images: row.productImages ?? [],
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
    async addItem(userId, sessionId, productId, quantity) {
        if (!productId) {
            throw new common_1.BadRequestException('productId 不能为空');
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new common_1.BadRequestException('quantity 必须是正整数');
        }
        const productRows = await this.db
            .select({ id: schema_1.products.id, stock: schema_1.products.stock, status: schema_1.products.status })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId));
        if (productRows.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        const product = productRows[0];
        if (product.status !== 'active') {
            throw new common_1.BadRequestException('商品已下架');
        }
        if (!userId && !sessionId) {
            throw new common_1.BadRequestException('无法识别购物车');
        }
        const sessionVal = userId ? userId : sessionId;
        const userIdVal = userId ?? null;
        const existingCondition = userId
            ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId), (0, drizzle_orm_1.eq)(schema_1.cartItems.productId, productId))
            : (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.sessionId, sessionVal), (0, drizzle_orm_1.eq)(schema_1.cartItems.productId, productId));
        const existingRows = await this.db
            .select({ id: schema_1.cartItems.id, quantity: schema_1.cartItems.quantity })
            .from(schema_1.cartItems)
            .where(existingCondition);
        let newQty;
        let itemId;
        if (existingRows.length > 0) {
            newQty = existingRows[0].quantity + quantity;
            itemId = existingRows[0].id;
            await this.db
                .update(schema_1.cartItems)
                .set({ quantity: newQty })
                .where((0, drizzle_orm_1.eq)(schema_1.cartItems.id, itemId));
        }
        else {
            newQty = quantity;
            const inserted = await this.db
                .insert(schema_1.cartItems)
                .values({
                productId,
                quantity,
                sessionId: sessionVal,
                userId: userIdVal,
            })
                .returning({ id: schema_1.cartItems.id });
            itemId = inserted[0].id;
        }
        if (newQty > product.stock) {
            await this.db
                .update(schema_1.cartItems)
                .set({ quantity: product.stock })
                .where((0, drizzle_orm_1.eq)(schema_1.cartItems.id, itemId));
            throw new common_1.BadRequestException('库存不足');
        }
        return this.getCart(userId, sessionId);
    }
    async updateItem(userId, sessionId, itemId, quantity) {
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new common_1.BadRequestException('quantity 必须是正整数');
        }
        let whereCondition;
        if (userId) {
            whereCondition = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.id, itemId), (0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId));
        }
        else if (sessionId) {
            whereCondition = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.id, itemId), (0, drizzle_orm_1.eq)(schema_1.cartItems.sessionId, sessionId));
        }
        else {
            throw new common_1.BadRequestException('无法识别购物车');
        }
        const existingRows = await this.db
            .select({ id: schema_1.cartItems.id, productId: schema_1.cartItems.productId })
            .from(schema_1.cartItems)
            .where(whereCondition);
        if (existingRows.length === 0) {
            throw new common_1.NotFoundException('购物车商品不存在');
        }
        const productRows = await this.db
            .select({ stock: schema_1.products.stock })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, existingRows[0].productId));
        if (productRows.length === 0 || productRows[0].stock < quantity) {
            throw new common_1.BadRequestException('库存不足');
        }
        await this.db
            .update(schema_1.cartItems)
            .set({ quantity })
            .where((0, drizzle_orm_1.eq)(schema_1.cartItems.id, itemId));
        return this.getCart(userId, sessionId);
    }
    async removeItem(userId, sessionId, itemId) {
        let whereCondition;
        if (userId) {
            whereCondition = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.id, itemId), (0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId));
        }
        else if (sessionId) {
            whereCondition = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.id, itemId), (0, drizzle_orm_1.eq)(schema_1.cartItems.sessionId, sessionId));
        }
        else {
            throw new common_1.BadRequestException('无法识别购物车');
        }
        const result = await this.db
            .delete(schema_1.cartItems)
            .where(whereCondition)
            .returning({ id: schema_1.cartItems.id });
        if (result.length === 0) {
            throw new common_1.NotFoundException('购物车商品不存在');
        }
        return this.getCart(userId, sessionId);
    }
    async clearCart(userId, sessionId) {
        if (userId) {
            await this.db.delete(schema_1.cartItems).where((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId));
        }
        else if (sessionId) {
            await this.db.delete(schema_1.cartItems).where((0, drizzle_orm_1.eq)(schema_1.cartItems.sessionId, sessionId));
        }
    }
    generateRecoveryCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 12; i += 1) {
            const idx = Math.floor(Math.random() * chars.length);
            code += chars[idx];
        }
        return code;
    }
    async exportRecoveryCode(sessionId) {
        const cart = await this.getCart(undefined, sessionId);
        if (cart.items.length === 0) {
            throw new common_1.BadRequestException('购物车为空，无法生成恢复码');
        }
        const code = this.generateRecoveryCode();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await this.db.insert(schema_1.cartRecoveryCodes).values({
            code,
            sessionId,
            expiresAt,
        });
        return { code };
    }
    async importRecoveryCode(currentSessionId, code) {
        const trimmedCode = code.trim().toUpperCase();
        if (!trimmedCode) {
            throw new common_1.BadRequestException('恢复码不能为空');
        }
        const now = new Date();
        const codeRows = await this.db
            .select({
            id: schema_1.cartRecoveryCodes.id,
            sessionId: schema_1.cartRecoveryCodes.sessionId,
            used: schema_1.cartRecoveryCodes.used,
            expiresAt: schema_1.cartRecoveryCodes.expiresAt,
        })
            .from(schema_1.cartRecoveryCodes)
            .where((0, drizzle_orm_1.eq)(schema_1.cartRecoveryCodes.code, trimmedCode));
        if (codeRows.length === 0) {
            throw new common_1.BadRequestException('恢复码不存在');
        }
        const recoveryRecord = codeRows[0];
        if (recoveryRecord.used) {
            throw new common_1.BadRequestException('恢复码已被使用');
        }
        if (recoveryRecord.expiresAt <= now) {
            throw new common_1.BadRequestException('恢复码已过期');
        }
        const sourceItems = await this.db
            .select({
            productId: schema_1.cartItems.productId,
            quantity: schema_1.cartItems.quantity,
        })
            .from(schema_1.cartItems)
            .where((0, drizzle_orm_1.eq)(schema_1.cartItems.sessionId, recoveryRecord.sessionId));
        if (sourceItems.length === 0) {
            await this.db
                .update(schema_1.cartRecoveryCodes)
                .set({ used: true })
                .where((0, drizzle_orm_1.eq)(schema_1.cartRecoveryCodes.id, recoveryRecord.id));
            return this.getCart(undefined, currentSessionId);
        }
        await this.db.transaction(async (tx) => {
            await tx
                .update(schema_1.cartRecoveryCodes)
                .set({ used: true })
                .where((0, drizzle_orm_1.eq)(schema_1.cartRecoveryCodes.id, recoveryRecord.id));
            for (const item of sourceItems) {
                await tx
                    .insert(schema_1.cartItems)
                    .values({
                    sessionId: currentSessionId,
                    productId: item.productId,
                    quantity: item.quantity,
                })
                    .onConflictDoUpdate({
                    target: [schema_1.cartItems.sessionId, schema_1.cartItems.productId],
                    set: {
                        quantity: (0, drizzle_orm_1.sql) `${schema_1.cartItems.quantity} + ${item.quantity}`,
                    },
                });
            }
        });
        return this.getCart(undefined, currentSessionId);
    }
};
exports.CartService = CartService;
exports.CartService = CartService = CartService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], CartService);
//# sourceMappingURL=cart.service.js.map