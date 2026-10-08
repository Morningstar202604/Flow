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
var FavoritesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoritesService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
let FavoritesService = FavoritesService_1 = class FavoritesService {
    db;
    logger = new common_1.Logger(FavoritesService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getMyFavorites(userId) {
        if (!userId)
            return [];
        const rows = await this.db
            .select({
            id: schema_1.favorites.id,
            userId: schema_1.favorites.userId,
            productId: schema_1.favorites.productId,
            createdAt: schema_1.favorites.createdAt,
            product: schema_1.products,
        })
            .from(schema_1.favorites)
            .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.favorites.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.eq)(schema_1.favorites.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.favorites.createdAt));
        return rows.map((row) => ({
            id: row.id,
            userId: row.userId,
            productId: row.productId,
            createdAt: row.createdAt.toISOString(),
            product: {
                id: row.product.id,
                sku: row.product.sku ?? undefined,
                titleZh: row.product.titleZh,
                titleEn: row.product.titleEn,
                descZh: row.product.descZh ?? '',
                descEn: row.product.descEn ?? '',
                longDescZh: row.product.longDescZh ?? '',
                longDescEn: row.product.longDescEn ?? '',
                categoryId: row.product.categoryId ?? undefined,
                price: row.product.price.toString(),
                originalPrice: row.product.originalPrice?.toString(),
                stock: Number(row.product.stock),
                sold: Number(row.product.sold),
                status: row.product.status,
                coverImage: row.product.coverImage ?? undefined,
                images: row.product.images ?? [],
                specs: row.product.specs,
                seoKeywordsZh: row.product.seoKeywordsZh ?? '',
                seoKeywordsEn: row.product.seoKeywordsEn ?? '',
                bulletPointsZh: row.product.bulletPointsZh ?? [],
                bulletPointsEn: row.product.bulletPointsEn ?? [],
                weight: row.product.weight?.toString(),
                createdAt: row.product.createdAt.toISOString(),
                updatedAt: row.product.updatedAt.toISOString(),
            },
        }));
    }
    async toggle(productId, userId) {
        if (!userId) {
            throw new common_1.ForbiddenException('请先登录');
        }
        const productRows = await this.db
            .select({ id: schema_1.products.id })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId));
        if (productRows.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        const existing = await this.db
            .select({ id: schema_1.favorites.id })
            .from(schema_1.favorites)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.favorites.userId, userId), (0, drizzle_orm_1.eq)(schema_1.favorites.productId, productId)));
        if (existing.length > 0) {
            await this.db
                .delete(schema_1.favorites)
                .where((0, drizzle_orm_1.eq)(schema_1.favorites.id, existing[0].id));
            return { favorited: false };
        }
        const inserted = await this.db
            .insert(schema_1.favorites)
            .values({ userId, productId })
            .returning({ id: schema_1.favorites.id });
        return { favorited: true, id: inserted[0].id };
    }
    async isFavoritedBatch(productIds, userId) {
        if (!userId || productIds.length === 0)
            return [];
        const rows = await this.db
            .select({ productId: schema_1.favorites.productId })
            .from(schema_1.favorites)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.favorites.userId, userId), (0, drizzle_orm_1.inArray)(schema_1.favorites.productId, productIds)));
        return rows.map((row) => row.productId);
    }
    async isFavorited(productId, userId) {
        if (!userId)
            return false;
        const rows = await this.db
            .select({ id: schema_1.favorites.id })
            .from(schema_1.favorites)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.favorites.userId, userId), (0, drizzle_orm_1.eq)(schema_1.favorites.productId, productId)))
            .limit(1);
        return rows.length > 0;
    }
};
exports.FavoritesService = FavoritesService;
exports.FavoritesService = FavoritesService = FavoritesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], FavoritesService);
//# sourceMappingURL=favorites.service.js.map