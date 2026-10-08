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
var ProductsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const schema_1 = require("@server/database/schema");
const drizzle_orm_1 = require("drizzle-orm");
const audit_service_1 = require("../audit/audit.service");
let ProductsService = ProductsService_1 = class ProductsService {
    db;
    auditService;
    logger = new common_1.Logger(ProductsService_1.name);
    constructor(db, auditService) {
        this.db = db;
        this.auditService = auditService;
    }
    toDto(row) {
        return {
            id: row.id,
            sku: row.sku ?? undefined,
            titleZh: row.titleZh,
            titleEn: row.titleEn,
            descZh: row.descZh ?? '',
            descEn: row.descEn ?? '',
            longDescZh: row.longDescZh ?? '',
            longDescEn: row.longDescEn ?? '',
            categoryId: row.categoryId ?? undefined,
            categoryNameZh: row.categoryNameZh ?? undefined,
            categoryNameEn: row.categoryNameEn ?? undefined,
            price: String(row.price),
            originalPrice: row.originalPrice ? String(row.originalPrice) : undefined,
            stock: row.stock,
            sold: row.sold,
            status: row.status,
            coverImage: row.coverImage ?? undefined,
            images: row.images ?? [],
            specs: row.specs ? JSON.parse(row.specs) : {},
            seoKeywordsZh: row.seoKeywordsZh ?? '',
            seoKeywordsEn: row.seoKeywordsEn ?? '',
            bulletPointsZh: row.bulletPointsZh ?? [],
            bulletPointsEn: row.bulletPointsEn ?? [],
            weight: row.weight ? String(row.weight) : undefined,
            avgRating: row.avgRating != null ? Number(row.avgRating) : undefined,
            reviewCount: row.reviewCount != null ? Number(row.reviewCount) : undefined,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        };
    }
    buildWhere(params) {
        const conditions = [];
        if (params.status !== undefined) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.products.status, params.status));
        }
        else {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.products.status, 'active'));
        }
        if (params.categoryId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.products.categoryId, params.categoryId));
        }
        if (params.keyword) {
            const escaped = params.keyword.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
            const keyword = `%${escaped}%`;
            conditions.push((0, drizzle_orm_1.sql) `(${(0, drizzle_orm_1.ilike)(schema_1.products.titleZh, keyword)} OR ${(0, drizzle_orm_1.ilike)(schema_1.products.titleEn, keyword)})`);
        }
        if (params.minPrice !== undefined) {
            conditions.push((0, drizzle_orm_1.gte)(schema_1.products.price, String(params.minPrice)));
        }
        if (params.maxPrice !== undefined) {
            conditions.push((0, drizzle_orm_1.lte)(schema_1.products.price, String(params.maxPrice)));
        }
        return conditions;
    }
    getOrderBy(sortBy) {
        switch (sortBy) {
            case 'price_asc':
                return [(0, drizzle_orm_1.asc)(schema_1.products.price)];
            case 'price_desc':
                return [(0, drizzle_orm_1.desc)(schema_1.products.price)];
            case 'sold_desc':
                return [(0, drizzle_orm_1.desc)(schema_1.products.sold)];
            case 'newest':
            default:
                return [(0, drizzle_orm_1.desc)(schema_1.products.createdAt)];
        }
    }
    async findAll(params) {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const offset = (page - 1) * pageSize;
        const conditions = this.buildWhere(params);
        const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        const orderBy = this.getOrderBy(params.sortBy);
        const baseQuery = this.db
            .select({
            ...schema_1.products,
            categoryNameZh: schema_1.categories.nameZh,
            categoryNameEn: schema_1.categories.nameEn,
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .where(whereClause)
            .orderBy(...orderBy, (0, drizzle_orm_1.desc)(schema_1.products.id));
        const [countResult, rows] = await Promise.all([
            this.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.products)
                .where(whereClause),
            baseQuery.limit(pageSize).offset(offset),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        const items = rows.map((row) => this.toDto(row));
        return { items, total, page, pageSize };
    }
    async findOne(id) {
        const rows = await this.db
            .select({
            ...schema_1.products,
            categoryNameZh: schema_1.categories.nameZh,
            categoryNameEn: schema_1.categories.nameEn,
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, id))
            .limit(1);
        if (rows.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        const result = this.toDto(rows[0]);
        const reviewStats = await this.db
            .select({
            avgRating: (0, drizzle_orm_1.sql) `round(avg(${schema_1.reviews.rating})::numeric, 1)`,
            reviewCount: (0, drizzle_orm_1.count)(schema_1.reviews.id),
        })
            .from(schema_1.reviews)
            .where((0, drizzle_orm_1.eq)(schema_1.reviews.productId, id));
        if (reviewStats.length > 0) {
            result.avgRating = reviewStats[0].avgRating != null ? Number(reviewStats[0].avgRating) : 0;
            result.reviewCount = Number(reviewStats[0].reviewCount);
        }
        else {
            result.avgRating = 0;
            result.reviewCount = 0;
        }
        return result;
    }
    async getFeatured() {
        const rows = await this.db
            .select({
            ...schema_1.products,
            categoryNameZh: schema_1.categories.nameZh,
            categoryNameEn: schema_1.categories.nameEn,
        })
            .from(schema_1.products)
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .where((0, drizzle_orm_1.eq)(schema_1.products.status, 'active'))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.products.sold), (0, drizzle_orm_1.desc)(schema_1.products.createdAt))
            .limit(8);
        return rows.map((row) => this.toDto(row));
    }
    async create(input, userId) {
        try {
            this.validateProductImages(input.coverImage, input.images);
            const [row] = await this.db
                .insert(schema_1.products)
                .values({
                sellerId: userId,
                sku: input.sku,
                titleZh: input.titleZh,
                titleEn: input.titleEn,
                descZh: input.descZh,
                descEn: input.descEn,
                longDescZh: input.longDescZh,
                longDescEn: input.longDescEn,
                categoryId: input.categoryId,
                price: String(input.price),
                originalPrice: input.originalPrice !== undefined ? String(input.originalPrice) : undefined,
                stock: input.stock ?? 0,
                status: input.status ?? 'draft',
                coverImage: input.coverImage,
                images: input.images ?? [],
                specs: input.specs ? JSON.stringify(input.specs) : '{}',
                seoKeywordsZh: input.seoKeywordsZh,
                seoKeywordsEn: input.seoKeywordsEn,
                bulletPointsZh: input.bulletPointsZh ?? [],
                bulletPointsEn: input.bulletPointsEn ?? [],
                weight: input.weight !== undefined ? String(input.weight) : undefined,
            })
                .returning();
            if (!row) {
                throw new common_1.BadRequestException('创建商品失败');
            }
            return this.findOne(row.id);
        }
        catch (error) {
            this.logger.error('创建商品失败', error);
            throw error;
        }
    }
    async update(id, input, userId, auditMeta) {
        // Query current product for before-value audit
        const existingRows = await this.db
            .select({ price: schema_1.products.price, status: schema_1.products.status })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, id));
        if (existingRows.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        const existing = existingRows[0];
        const oldPrice = existing.price;
        const oldStatus = existing.status;
        const patch = {};
        if (input.coverImage !== undefined || input.images !== undefined) {
            this.validateProductImages(input.coverImage ?? undefined, input.images ?? undefined);
        }
        if (input.sku !== undefined)
            patch.sku = input.sku;
        if (input.titleZh !== undefined)
            patch.titleZh = input.titleZh;
        if (input.titleEn !== undefined)
            patch.titleEn = input.titleEn;
        if (input.descZh !== undefined)
            patch.descZh = input.descZh;
        if (input.descEn !== undefined)
            patch.descEn = input.descEn;
        if (input.longDescZh !== undefined)
            patch.longDescZh = input.longDescZh;
        if (input.longDescEn !== undefined)
            patch.longDescEn = input.longDescEn;
        if (input.categoryId !== undefined)
            patch.categoryId = input.categoryId;
        if (input.price !== undefined)
            patch.price = String(input.price);
        if (input.originalPrice !== undefined)
            patch.originalPrice = String(input.originalPrice);
        if (input.stock !== undefined)
            patch.stock = input.stock;
        if (input.status !== undefined)
            patch.status = input.status;
        if (input.coverImage !== undefined)
            patch.coverImage = input.coverImage;
        if (input.images !== undefined)
            patch.images = input.images;
        if (input.specs !== undefined)
            patch.specs = JSON.stringify(input.specs);
        if (input.seoKeywordsZh !== undefined)
            patch.seoKeywordsZh = input.seoKeywordsZh;
        if (input.seoKeywordsEn !== undefined)
            patch.seoKeywordsEn = input.seoKeywordsEn;
        if (input.bulletPointsZh !== undefined)
            patch.bulletPointsZh = input.bulletPointsZh;
        if (input.bulletPointsEn !== undefined)
            patch.bulletPointsEn = input.bulletPointsEn;
        if (input.weight !== undefined)
            patch.weight = String(input.weight);
        if (Object.keys(patch).length === 0) {
            throw new common_1.BadRequestException('未提供可更新字段');
        }
        patch.updatedAt = new Date();
        patch.updatedBy = userId;
        const updated = await this.db
            .update(schema_1.products)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, id))
            .returning({ id: schema_1.products.id });
        if (updated.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        const result = await this.findOne(id);
        // Audit log: price change
        if (input.price !== undefined && String(input.price) !== oldPrice) {
            try {
                void this.auditService.log({
                    action: 'product.price_change',
                    entity: 'product',
                    entityId: id,
                    before: { oldPrice },
                    after: { newPrice: String(input.price) },
                    userId: userId,
                    role: auditMeta?.role,
                    ip: auditMeta?.ip,
                }).catch(() => { });
            }
            catch {
                // Audit log failure must not affect main flow
            }
        }
        // Audit log: status toggle
        if (input.status !== undefined && input.status !== oldStatus) {
            try {
                void this.auditService.log({
                    action: 'product.toggle_status',
                    entity: 'product',
                    entityId: id,
                    before: { oldStatus },
                    after: { newStatus: input.status },
                    userId: userId,
                    role: auditMeta?.role,
                    ip: auditMeta?.ip,
                }).catch(() => { });
            }
            catch {
                // Audit log failure must not affect main flow
            }
        }
        return result;
    }
    async remove(id) {
        const deleted = await this.db
            .delete(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, id))
            .returning({ id: schema_1.products.id });
        if (deleted.length === 0) {
            throw new common_1.NotFoundException('商品不存在');
        }
        return { id };
    }
    validateProductImages(coverImage, images) {
        const MAX_URL_LENGTH = 500;
        const MAX_IMAGES_COUNT = 10;
        const isValidImageUrl = (url) => {
            if (url.length > MAX_URL_LENGTH)
                return false;
            if (!url.startsWith('http://') && !url.startsWith('https://'))
                return false;
            try {
                const parsed = new URL(url);
                return parsed.protocol === 'http:' || parsed.protocol === 'https:';
            }
            catch {
                return false;
            }
        };
        if (coverImage && !isValidImageUrl(coverImage)) {
            throw new common_1.BadRequestException('封面图 URL 格式不正确，必须以 http:// 或 https:// 开头且不超过 500 字符');
        }
        if (images) {
            if (images.length > MAX_IMAGES_COUNT) {
                throw new common_1.BadRequestException(`商品图片不能超过 ${MAX_IMAGES_COUNT} 张`);
            }
            for (const img of images) {
                if (!isValidImageUrl(img)) {
                    throw new common_1.BadRequestException('商品图片 URL 格式不正确，必须以 http:// 或 https:// 开头且不超过 500 字符');
                }
            }
        }
    }
    getImportTemplateCsv() {
        return 'nameZh,nameEn,category,price,stock,descriptionZh,descriptionEn,images\n';
    }
    async bulkImport(fileBuffer, userId, auditMeta) {
        const content = fileBuffer.toString('utf-8');
        const rows = this.parseCsv(content);
        if (rows.length === 0) {
            return { successCount: 0, failCount: 0, failures: [] };
        }
        // Load all categories for matching
        const allCategories = await this.db.select({
            id: schema_1.categories.id,
            nameZh: schema_1.categories.nameZh,
            nameEn: schema_1.categories.nameEn,
            slug: schema_1.categories.slug,
        }).from(schema_1.categories);
        const categoryMap = new Map();
        for (const cat of allCategories) {
            categoryMap.set(cat.nameZh.toLowerCase(), cat.id);
            categoryMap.set(cat.nameEn.toLowerCase(), cat.id);
            categoryMap.set(cat.slug.toLowerCase(), cat.id);
        }
        const failures = [];
        const validRecords = [];
        rows.forEach((row, index) => {
            const rowNum = index + 2; // row 1 is header
            const reasons = [];
            if (!row.nameZh || row.nameZh.trim() === '') {
                reasons.push('nameZh 必填');
            }
            if (!row.nameEn || row.nameEn.trim() === '') {
                reasons.push('nameEn 必填');
            }
            const priceNum = Number(row.price);
            if (isNaN(priceNum) || priceNum <= 0) {
                reasons.push('price 必须是正数');
            }
            const stockNum = Number(row.stock);
            if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
                reasons.push('stock 必须是非负整数');
            }
            let categoryId;
            if (row.category && row.category.trim() !== '') {
                categoryId = categoryMap.get(row.category.trim().toLowerCase());
                if (!categoryId) {
                    reasons.push(`分类 "${row.category}" 未找到匹配`);
                }
            }
            if (reasons.length > 0) {
                failures.push({ row: rowNum, reason: reasons.join('; ') });
                return;
            }
            const imageList = row.images
                ? row.images.split('|').map((s) => s.trim()).filter(Boolean)
                : [];
            validRecords.push({
                sellerId: userId,
                titleZh: row.nameZh.trim(),
                titleEn: row.nameEn.trim(),
                descZh: row.descriptionZh || null,
                descEn: row.descriptionEn || null,
                categoryId,
                price: String(priceNum),
                stock: Math.floor(stockNum),
                status: 'active',
                coverImage: imageList[0] ?? null,
                images: imageList,
                updatedBy: userId,
            });
        });
        let successCount = 0;
        if (validRecords.length > 0) {
            try {
                // Insert in batches of 100
                const batchSize = 100;
                for (let i = 0; i < validRecords.length; i += batchSize) {
                    const batch = validRecords.slice(i, i + batchSize);
                    await this.db.insert(schema_1.products).values(batch);
                }
                successCount = validRecords.length;
            }
            catch (error) {
                this.logger.error('批量导入商品失败', error);
                // Mark all valid records as failed
                for (let i = 0; i < validRecords.length; i++) {
                    const rowNum = rows.findIndex((_r, idx) => {
                        // find the original row index
                        const originalIdx = idx + 2;
                        return !failures.some((f) => f.row === originalIdx) &&
                            failures.length + validRecords.length === rows.length &&
                            i === idx - failures.filter((f) => f.row < originalIdx).length;
                    });
                    failures.push({
                        row: i + failures.length + 2,
                        reason: '数据库写入失败',
                    });
                }
            }
        }
        const result = {
            successCount,
            failCount: failures.length,
            failures,
        };
        // Audit log for CSV import
        if (successCount > 0) {
            try {
                void this.auditService.log({
                    action: 'csv.import',
                    entity: 'product',
                    entityId: 'batch',
                    after: { count: successCount },
                    userId: userId,
                    role: auditMeta?.role,
                    ip: auditMeta?.ip,
                }).catch(() => { });
            }
            catch {
                // Audit log failure must not affect main flow
            }
        }
        return result;
    }
    parseCsv(content) {
        const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
        if (lines.length <= 1) {
            return [];
        }
        // Skip header line
        const dataLines = lines.slice(1);
        const result = [];
        for (const line of dataLines) {
            const fields = this.parseCsvLine(line);
            result.push({
                nameZh: fields[0] ?? '',
                nameEn: fields[1] ?? '',
                category: fields[2] ?? '',
                price: fields[3] ?? '',
                stock: fields[4] ?? '',
                descriptionZh: fields[5] ?? '',
                descriptionEn: fields[6] ?? '',
                images: fields[7] ?? '',
            });
        }
        return result;
    }
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (inQuotes) {
                if (char === '"') {
                    if (line[i + 1] === '"') {
                        current += '"';
                        i++;
                    }
                    else {
                        inQuotes = false;
                    }
                }
                else {
                    current += char;
                }
            }
            else {
                if (char === '"') {
                    inQuotes = true;
                }
                else if (char === ',') {
                    result.push(current);
                    current = '';
                }
                else {
                    current += char;
                }
            }
        }
        result.push(current);
        return result;
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = ProductsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, audit_service_1.AuditService])
], ProductsService);
//# sourceMappingURL=products.service.js.map