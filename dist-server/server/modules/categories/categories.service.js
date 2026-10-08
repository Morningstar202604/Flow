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
var CategoriesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriesService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const schema_1 = require("@server/database/schema");
const drizzle_orm_1 = require("drizzle-orm");
let CategoriesService = CategoriesService_1 = class CategoriesService {
    db;
    logger = new common_1.Logger(CategoriesService_1.name);
    constructor(db) {
        this.db = db;
    }
    toDto(row) {
        return {
            id: row.id,
            nameZh: row.nameZh,
            nameEn: row.nameEn,
            slug: row.slug,
            icon: row.icon ?? undefined,
            sortOrder: row.sortOrder ?? 0,
        };
    }
    async findAll() {
        const rows = await this.db
            .select()
            .from(schema_1.categories)
            .orderBy((0, drizzle_orm_1.asc)(schema_1.categories.sortOrder), (0, drizzle_orm_1.asc)(schema_1.categories.nameZh));
        return rows.map((row) => this.toDto(row));
    }
    async create(input, userId) {
        try {
            const [row] = await this.db
                .insert(schema_1.categories)
                .values({
                nameZh: input.nameZh,
                nameEn: input.nameEn,
                slug: input.slug,
                icon: input.icon,
                sortOrder: input.sortOrder ?? 0,
                updatedBy: userId,
            })
                .returning();
            if (!row) {
                throw new common_1.BadRequestException('创建分类失败');
            }
            return this.toDto(row);
        }
        catch (error) {
            this.logger.error('创建分类失败', error);
            throw error;
        }
    }
    async update(id, input, userId) {
        const patch = {};
        if (input.nameZh !== undefined)
            patch.nameZh = input.nameZh;
        if (input.nameEn !== undefined)
            patch.nameEn = input.nameEn;
        if (input.slug !== undefined)
            patch.slug = input.slug;
        if (input.icon !== undefined)
            patch.icon = input.icon;
        if (input.sortOrder !== undefined)
            patch.sortOrder = input.sortOrder;
        if (Object.keys(patch).length === 0) {
            throw new common_1.BadRequestException('未提供可更新字段');
        }
        patch.updatedAt = new Date();
        patch.updatedBy = userId;
        const [row] = await this.db
            .update(schema_1.categories)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(schema_1.categories.id, id))
            .returning();
        if (!row) {
            throw new common_1.NotFoundException('分类不存在');
        }
        return this.toDto(row);
    }
    async remove(id) {
        const deleted = await this.db
            .delete(schema_1.categories)
            .where((0, drizzle_orm_1.eq)(schema_1.categories.id, id))
            .returning({ id: schema_1.categories.id });
        if (deleted.length === 0) {
            throw new common_1.NotFoundException('分类不存在');
        }
        return { id };
    }
};
exports.CategoriesService = CategoriesService;
exports.CategoriesService = CategoriesService = CategoriesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], CategoriesService);
//# sourceMappingURL=categories.service.js.map