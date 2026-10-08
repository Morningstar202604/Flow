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
var ReviewsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
let ReviewsService = ReviewsService_1 = class ReviewsService {
    db;
    logger = new common_1.Logger(ReviewsService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getProductReviews(productId) {
        const productRows = await this.db
            .select({ id: schema_1.products.id })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId));
        if (productRows.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        const rows = await this.db
            .select({
            id: schema_1.reviews.id,
            productId: schema_1.reviews.productId,
            userId: schema_1.reviews.userId,
            userName: schema_1.users.name,
            rating: schema_1.reviews.rating,
            content: schema_1.reviews.content,
            createdAt: schema_1.reviews.createdAt,
        })
            .from(schema_1.reviews)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.reviews.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.reviews.productId, productId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.reviews.createdAt));
        const avgResult = await this.db
            .select({ avg: (0, drizzle_orm_1.sql) `AVG(${schema_1.reviews.rating})::numeric` })
            .from(schema_1.reviews)
            .where((0, drizzle_orm_1.eq)(schema_1.reviews.productId, productId));
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.reviews)
            .where((0, drizzle_orm_1.eq)(schema_1.reviews.productId, productId));
        const items = rows.map((row) => ({
            id: row.id,
            productId: row.productId,
            userId: row.userId,
            userName: row.userName,
            rating: Number(row.rating),
            content: row.content ?? undefined,
            createdAt: row.createdAt.toISOString(),
        }));
        return {
            items,
            averageRating: avgResult[0]?.avg ? Number(avgResult[0].avg) : 0,
            totalCount: Number(countResult[0]?.count ?? 0),
        };
    }
    async createReview(productId, userId, dto) {
        if (!userId) {
            throw new common_1.ForbiddenException('请先登录后评价');
        }
        if (!dto.rating || dto.rating < 1 || dto.rating > 5) {
            throw new common_1.BadRequestException('评分必须在 1-5 之间');
        }
        const productRows = await this.db
            .select({ id: schema_1.products.id })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId));
        if (productRows.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        const existing = await this.db
            .select({ id: schema_1.reviews.id })
            .from(schema_1.reviews)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reviews.productId, productId), (0, drizzle_orm_1.eq)(schema_1.reviews.userId, userId)));
        if (existing.length > 0) {
            throw new common_1.ConflictException('你已评价过该商品');
        }
        const purchasedRows = await this.db
            .select({ id: schema_1.orderItems.id })
            .from(schema_1.orderItems)
            .innerJoin(schema_1.orders, (0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, schema_1.orders.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orderItems.productId, productId), (0, drizzle_orm_1.eq)(schema_1.orders.userId, userId), (0, drizzle_orm_1.sql) `${schema_1.orders.status} IN ('paid', 'shipped', 'delivered')`))
            .limit(1);
        if (purchasedRows.length === 0) {
            throw new common_1.ForbiddenException('请先购买该商品后再评价');
        }
        const inserted = await this.db
            .insert(schema_1.reviews)
            .values({
            productId,
            userId,
            rating: dto.rating,
            content: dto.comment ?? null,
        })
            .returning();
        const userRows = await this.db
            .select({ name: schema_1.users.name })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        return {
            id: inserted[0].id,
            productId: inserted[0].productId,
            userId: inserted[0].userId,
            userName: userRows[0]?.name ?? '用户',
            rating: Number(inserted[0].rating),
            comment: inserted[0].content ?? undefined,
            createdAt: inserted[0].createdAt.toISOString(),
        };
    }
    async getUserReviewForProduct(productId, userId) {
        if (!userId)
            return null;
        const rows = await this.db
            .select({
            id: schema_1.reviews.id,
            productId: schema_1.reviews.productId,
            userId: schema_1.reviews.userId,
            userName: schema_1.users.name,
            rating: schema_1.reviews.rating,
            content: schema_1.reviews.content,
            createdAt: schema_1.reviews.createdAt,
        })
            .from(schema_1.reviews)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.reviews.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reviews.productId, productId), (0, drizzle_orm_1.eq)(schema_1.reviews.userId, userId)));
        if (rows.length === 0)
            return null;
        return {
            id: rows[0].id,
            productId: rows[0].productId,
            userId: rows[0].userId,
            userName: rows[0].userName,
            rating: Number(rows[0].rating),
            comment: rows[0].content ?? undefined,
            createdAt: rows[0].createdAt.toISOString(),
        };
    }
    async hasPurchased(productId, userId) {
        if (!userId)
            return false;
        const rows = await this.db
            .select({ id: schema_1.orderItems.id })
            .from(schema_1.orderItems)
            .innerJoin(schema_1.orders, (0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, schema_1.orders.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orderItems.productId, productId), (0, drizzle_orm_1.eq)(schema_1.orders.userId, userId), (0, drizzle_orm_1.sql) `${schema_1.orders.status} IN ('paid', 'shipped', 'delivered')`))
            .limit(1);
        return rows.length > 0;
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = ReviewsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map