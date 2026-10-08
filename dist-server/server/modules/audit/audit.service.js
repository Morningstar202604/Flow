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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
let AuditService = AuditService_1 = class AuditService {
    db;
    logger = new common_1.Logger(AuditService_1.name);
    constructor(db) {
        this.db = db;
    }
    serialize(val) {
        return val ? JSON.stringify(val) : undefined;
    }
    deserialize(val) {
        if (!val)
            return undefined;
        try {
            return JSON.parse(val);
        }
        catch {
            return undefined;
        }
    }
    mapRow(row) {
        return {
            id: row.id,
            userId: row.userId ?? undefined,
            role: row.role ?? undefined,
            action: row.action,
            entity: row.entity ?? undefined,
            entityId: row.entityId ?? undefined,
            before: this.deserialize(row.before),
            after: this.deserialize(row.after),
            ip: row.ipAddress ?? undefined,
            createdAt: row.createdAt.toISOString(),
        };
    }
    async log(params) {
        try {
            await this.db.insert(schema_1.auditLogs).values({
                action: params.action,
                entity: params.entity,
                entityId: params.entityId,
                before: this.serialize(params.before),
                after: this.serialize(params.after),
                userId: params.userId,
                ipAddress: params.ip ?? undefined,
            });
        }
        catch (error) {
            this.logger.error('Failed to write audit log', error instanceof Error ? error.stack : String(error));
        }
    }
    async getAuditLogs(params) {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const safePage = Math.max(1, page);
        const safePageSize = Math.min(100, Math.max(1, pageSize));
        const offset = (safePage - 1) * safePageSize;
        const conditions = [];
        if (params.action) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.auditLogs.action, params.action));
        }
        if (params.startDate) {
            conditions.push((0, drizzle_orm_1.gte)(schema_1.auditLogs.createdAt, new Date(params.startDate)));
        }
        if (params.endDate) {
            conditions.push((0, drizzle_orm_1.lt)(schema_1.auditLogs.createdAt, new Date(params.endDate)));
        }
        if (params.userId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.auditLogs.userId, params.userId));
        }
        const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        const [countResult, rows] = await Promise.all([
            this.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.auditLogs).where(whereClause),
            this.db
                .select()
                .from(schema_1.auditLogs)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.auditLogs.createdAt))
                .limit(safePageSize)
                .offset(offset),
        ]);
        const total = Number(countResult[0]?.count ?? 0);
        const items = rows.map((row) => this.mapRow(row));
        return { items, total, page: safePage, pageSize: safePageSize };
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], AuditService);
//# sourceMappingURL=audit.service.js.map