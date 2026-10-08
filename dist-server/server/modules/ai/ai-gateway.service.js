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
var AiGatewayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiGatewayService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const drizzle_orm_1 = require("drizzle-orm");
const database_provider_1 = require("../../database/database.provider");
const schema_1 = require("@server/database/schema");
let AiGatewayService = AiGatewayService_1 = class AiGatewayService {
    httpService;
    db;
    logger = new common_1.Logger(AiGatewayService_1.name);
    baseUrl;
    apiKey;
    model;
    constructor(httpService, db) {
        this.httpService = httpService;
        this.db = db;
        this.baseUrl = process.env.LLM_BASE_URL || '';
        this.apiKey = process.env.LLM_API_KEY || '';
        this.model = process.env.LLM_MODEL || 'deepseek-chat';
    }
    isConfigured() {
        return Boolean(this.apiKey && this.baseUrl);
    }
    getModel() {
        return this.model;
    }
    ensureConfigured() {
        if (!this.isConfigured()) {
            throw new common_1.BadRequestException('未配置 LLM API Key');
        }
    }
    async chat(messages, options) {
        const agent = options?.agent ?? 'unknown';
        const userId = options?.userId;
        const startMs = Date.now();
        if (!this.isConfigured()) {
            await this.logUsage({
                agent,
                success: false,
                durationMs: 0,
                errorMessage: '未配置 LLM API Key',
                userId,
            });
            throw new common_1.BadRequestException('未配置 LLM API Key');
        }
        const temperature = options?.temperature ?? 0.7;
        const maxTokens = options?.maxTokens ?? 2000;
        const responseFormat = options?.responseFormat === 'json'
            ? { type: 'json_object' }
            : undefined;
        const body = {
            model: this.model,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(responseFormat ? { response_format: responseFormat } : {}),
        };
        try {
            const url = `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            }));
            const choices = response.data?.choices;
            if (!choices || choices.length === 0) {
                throw new common_1.InternalServerErrorException('LLM 返回为空');
            }
            const content = choices[0]?.message?.content ?? '';
            if (!content) {
                throw new common_1.InternalServerErrorException('LLM 返回内容为空');
            }
            const usageRaw = response.data?.usage;
            const usage = usageRaw
                ? {
                    prompt_tokens: usageRaw.prompt_tokens ?? 0,
                    completion_tokens: usageRaw.completion_tokens ?? 0,
                    total_tokens: usageRaw.total_tokens ?? 0,
                }
                : undefined;
            const durationMs = Date.now() - startMs;
            void this.logUsage({
                agent,
                success: true,
                durationMs,
                inputTokens: usage?.prompt_tokens,
                outputTokens: usage?.completion_tokens,
                userId,
            });
            return { content, usage };
        }
        catch (error) {
            const durationMs = Date.now() - startMs;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('LLM 调用失败', error instanceof Error ? error.stack : String(error));
            void this.logUsage({
                agent,
                success: false,
                durationMs,
                errorMessage,
                userId,
            });
            if (error instanceof common_1.BadRequestException)
                throw error;
            throw new common_1.InternalServerErrorException('AI 服务调用失败，请稍后重试');
        }
    }
    async logUsage(params) {
        try {
            await this.db.insert(schema_1.aiUsageLog).values({
                agent: params.agent,
                model: this.model,
                inputTokens: params.inputTokens ?? 0,
                outputTokens: params.outputTokens ?? 0,
                durationMs: params.durationMs,
                success: params.success,
                errorMessage: params.errorMessage,
                userId: params.userId,
            });
        }
        catch (err) {
            this.logger.error('写入 AI 计量日志失败', err instanceof Error ? err.stack : String(err));
        }
    }
    async getUsageStats(params) {
        const conditions = [];
        if (params?.agent) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.aiUsageLog.agent, params.agent));
        }
        if (params?.startDate) {
            conditions.push((0, drizzle_orm_1.gte)(schema_1.aiUsageLog.createdAt, new Date(params.startDate)));
        }
        if (params?.endDate) {
            const end = new Date(params.endDate);
            end.setHours(23, 59, 59, 999);
            conditions.push((0, drizzle_orm_1.lte)(schema_1.aiUsageLog.createdAt, end));
        }
        const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        const aggregateRows = await this.db
            .select({
            totalCalls: (0, drizzle_orm_1.count)(schema_1.aiUsageLog.id),
            totalInputTokens: (0, drizzle_orm_1.sum)(schema_1.aiUsageLog.inputTokens).mapWith(Number),
            totalOutputTokens: (0, drizzle_orm_1.sum)(schema_1.aiUsageLog.outputTokens).mapWith(Number),
            totalDurationMs: (0, drizzle_orm_1.sum)(schema_1.aiUsageLog.durationMs).mapWith(Number),
        })
            .from(schema_1.aiUsageLog)
            .where(whereClause);
        const successCountRows = await this.db
            .select({ count: (0, drizzle_orm_1.count)(schema_1.aiUsageLog.id) })
            .from(schema_1.aiUsageLog)
            .where(whereClause
            ? (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(schema_1.aiUsageLog.success, true))
            : (0, drizzle_orm_1.eq)(schema_1.aiUsageLog.success, true));
        const byAgentRows = await this.db
            .select({
            agent: schema_1.aiUsageLog.agent,
            calls: (0, drizzle_orm_1.count)(schema_1.aiUsageLog.id),
            inputTokens: (0, drizzle_orm_1.sum)(schema_1.aiUsageLog.inputTokens).mapWith(Number),
            outputTokens: (0, drizzle_orm_1.sum)(schema_1.aiUsageLog.outputTokens).mapWith(Number),
            durationMs: (0, drizzle_orm_1.sum)(schema_1.aiUsageLog.durationMs).mapWith(Number),
        })
            .from(schema_1.aiUsageLog)
            .where(whereClause)
            .groupBy(schema_1.aiUsageLog.agent)
            .orderBy(schema_1.aiUsageLog.agent);
        const agg = aggregateRows[0];
        const totalCalls = Number(agg?.totalCalls ?? 0);
        const successCount = Number(successCountRows[0]?.count ?? 0);
        const successRate = totalCalls > 0 ? successCount / totalCalls : 0;
        return {
            totalCalls,
            totalInputTokens: agg?.totalInputTokens ?? 0,
            totalOutputTokens: agg?.totalOutputTokens ?? 0,
            totalDurationMs: agg?.totalDurationMs ?? 0,
            successRate,
            byAgent: byAgentRows.map((row) => ({
                agent: row.agent,
                calls: Number(row.calls),
                inputTokens: row.inputTokens ?? 0,
                outputTokens: row.outputTokens ?? 0,
                durationMs: row.durationMs ?? 0,
            })),
        };
    }
};
exports.AiGatewayService = AiGatewayService;
exports.AiGatewayService = AiGatewayService = AiGatewayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [axios_1.HttpService, Object])
], AiGatewayService);
//# sourceMappingURL=ai-gateway.service.js.map