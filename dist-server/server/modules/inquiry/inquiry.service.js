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
var InquiryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InquiryService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
let InquiryService = InquiryService_1 = class InquiryService {
    db;
    logger = new common_1.Logger(InquiryService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getSessions(page, pageSize, status) {
        const conditions = [];
        if (status) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.inquirySessions.status, status));
        }
        const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        const [totalResult, rows] = await Promise.all([
            this.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.inquirySessions)
                .where(whereClause),
            this.db
                .select()
                .from(schema_1.inquirySessions)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.inquirySessions.lastMessageAt), (0, drizzle_orm_1.desc)(schema_1.inquirySessions.createdAt))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
        ]);
        const total = totalResult[0]?.count ?? 0;
        const items = rows.map((row) => ({
            id: row.id,
            sessionId: row.sessionId,
            userId: row.userId ?? undefined,
            status: row.status ?? 'active',
            lastMessage: row.lastMessageAt
                ? row.lastMessageAt.toISOString()
                : undefined,
            lastMessageAt: row.lastMessageAt
                ? row.lastMessageAt.toISOString()
                : undefined,
            createdAt: row.createdAt.toISOString(),
        }));
        return { items, total, page, pageSize };
    }
    async getMessages(sessionId) {
        const rows = await this.db
            .select()
            .from(schema_1.inquiryMessages)
            .where((0, drizzle_orm_1.eq)(schema_1.inquiryMessages.sessionId, sessionId))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.inquiryMessages.createdAt));
        return rows.map((row) => ({
            id: row.id,
            sessionId: row.sessionId,
            role: row.role,
            content: row.content,
            createdAt: row.createdAt.toISOString(),
        }));
    }
    async sendMessage(body, sellerUserId) {
        const [inserted] = await this.db
            .insert(schema_1.inquiryMessages)
            .values({
            sessionId: body.sessionId,
            role: body.role,
            content: body.content,
        })
            .returning();
        if (!inserted) {
            throw new Error('消息创建失败');
        }
        // update session's last_message_at
        await this.db
            .update(schema_1.inquirySessions)
            .set({
            lastMessageAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.inquirySessions.sessionId, body.sessionId));
        // if seller responded, mark status
        if (sellerUserId && body.role === 'seller') {
            await this.db
                .update(schema_1.inquirySessions)
                .set({ status: 'active' })
                .where((0, drizzle_orm_1.eq)(schema_1.inquirySessions.sessionId, body.sessionId));
        }
        return {
            id: inserted.id,
            sessionId: inserted.sessionId,
            role: inserted.role,
            content: inserted.content,
            createdAt: inserted.createdAt.toISOString(),
        };
    }
    async createSession(sessionId, userId) {
        try {
            const [inserted] = await this.db
                .insert(schema_1.inquirySessions)
                .values({
                sessionId,
                userId: userId || null,
                status: 'active',
            })
                .returning();
            if (!inserted) {
                throw new Error('会话创建失败');
            }
            return {
                id: inserted.id,
                sessionId: inserted.sessionId,
                userId: inserted.userId ?? undefined,
                status: inserted.status ?? 'active',
                lastMessage: inserted.lastMessageAt
                    ? inserted.lastMessageAt.toISOString()
                    : undefined,
                lastMessageAt: inserted.lastMessageAt
                    ? inserted.lastMessageAt.toISOString()
                    : undefined,
                createdAt: inserted.createdAt.toISOString(),
            };
        }
        catch (error) {
            // unique violation: session already exists
            const code = this.extractErrorCode(error);
            if (code === '23505') {
                const existing = await this.db
                    .select()
                    .from(schema_1.inquirySessions)
                    .where((0, drizzle_orm_1.eq)(schema_1.inquirySessions.sessionId, sessionId))
                    .limit(1);
                if (existing[0]) {
                    const row = existing[0];
                    return {
                        id: row.id,
                        sessionId: row.sessionId,
                        userId: row.userId ?? undefined,
                        status: row.status ?? 'active',
                        lastMessage: row.lastMessageAt
                            ? row.lastMessageAt.toISOString()
                            : undefined,
                        lastMessageAt: row.lastMessageAt
                            ? row.lastMessageAt.toISOString()
                            : undefined,
                        createdAt: row.createdAt.toISOString(),
                    };
                }
            }
            this.logger.error('创建会话失败', error);
            if (error instanceof common_1.ConflictException)
                throw error;
            throw error;
        }
    }
    extractErrorCode(error) {
        let current = error;
        for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
            const { code, cause } = current;
            if (typeof code === 'string')
                return code;
            current = cause;
        }
        return undefined;
    }
};
exports.InquiryService = InquiryService;
exports.InquiryService = InquiryService = InquiryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], InquiryService);
//# sourceMappingURL=inquiry.service.js.map