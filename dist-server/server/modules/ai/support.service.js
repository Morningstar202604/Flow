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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_provider_1 = require("../../database/database.provider");
const ai_gateway_service_1 = require("./ai-gateway.service");
const schema_1 = require("@server/database/schema");
const embedding_service_1 = require("../embedding/embedding.service");
const SHOP_FAQS = [
    {
        keywords: ['退换', '退货', '退款', 'return', 'refund', 'exchange', '退换货'],
        question: '退换货政策',
        answer: '30天无理由退换，商品需保持全新未使用状态。',
    },
    {
        keywords: ['发货', '物流', '配送', 'shipping', 'delivery', 'dispatch', '多久到'],
        question: '发货时间',
        answer: '订单付款后2-5个工作日内发货。',
    },
    {
        keywords: ['支付', '付款', 'payment', 'paypal', '信用卡', '银行转账'],
        question: '支付方式',
        answer: '支持信用卡、PayPal、银行转账。',
    },
    {
        keywords: ['追踪', '运单号', 'tracking', '物流号', '快递', 'tracking number'],
        question: '物流追踪',
        answer: '发货后会通过邮件发送物流追踪号。',
    },
    {
        keywords: ['客服', '工作时间', '营业时间', 'support', 'service hours', '人工'],
        question: '客服时间',
        answer: '周一至周五 9:00-18:00 GMT+8。',
    },
];
let SupportService = class SupportService {
    db;
    aiGateway;
    embeddingService;
    constructor(db, aiGateway, embeddingService) {
        this.db = db;
        this.aiGateway = aiGateway;
        this.embeddingService = embeddingService;
    }
    async chat(dto, userId) {
        const messageLower = dto.message.toLowerCase();
        // RAG: 检索相关商品（优先向量检索，失败回退关键词匹配）
        const relatedProducts = await this.searchProducts(dto.message, dto.language);
        // RAG: 匹配店铺政策 FAQ
        const matchedFaqs = this.matchFaqs(messageLower);
        // 查询订单状态（如果有 orderNo）
        let orderInfo = '';
        if (dto.orderNo) {
            orderInfo = await this.getOrderInfo(dto.orderNo);
        }
        // 读取对话历史
        const historyMessages = await this.getHistoryMessages(dto.sessionId);
        // 构建上下文
        const contextParts = [];
        if (relatedProducts.length > 0) {
            const productsText = relatedProducts
                .map((p, i) => `${i + 1}. ${p.titleEn} - ${p.descEn || 'No description'} - Price: $${p.price}`)
                .join('\n');
            contextParts.push(`【相关商品】\n${productsText}`);
        }
        if (matchedFaqs.length > 0) {
            const faqsText = matchedFaqs
                .map((f) => `- ${f.question}: ${f.answer}`)
                .join('\n');
            contextParts.push(`【店铺政策】\n${faqsText}`);
        }
        if (orderInfo) {
            contextParts.push(`【订单信息】\n${orderInfo}`);
        }
        const systemPrompt = this.buildSystemPrompt(dto.language, contextParts.join('\n\n'));
        // 构建消息序列：system + history + current user
        const messages = [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content: dto.message },
        ];
        const { content: reply } = await this.aiGateway.chat(messages, {
            temperature: 0.5,
            maxTokens: 800,
            agent: 'support',
            userId,
        });
        // 收集 sources
        const sources = [];
        if (matchedFaqs.length > 0) {
            sources.push(...matchedFaqs.map((f) => `店铺政策 - ${f.question}`));
        }
        if (relatedProducts.length > 0) {
            sources.push(`相关商品 (${relatedProducts.length}个)`);
        }
        return {
            reply: reply.trim(),
            sources: sources.length > 0 ? sources : undefined,
        };
    }
    async searchProducts(query, language) {
        const lang = language === 'zh' ? 'zh' : 'en';
        // 优先尝试向量检索
        if (this.embeddingService && this.embeddingService.isReady()) {
            try {
                const similar = await this.embeddingService.searchSimilarProducts(query, lang, 5);
                if (similar.length > 0) {
                    const productIds = similar.map((s) => s.productId);
                    const rows = await this.db
                        .select({
                        id: schema_1.products.id,
                        titleEn: schema_1.products.titleEn,
                        descEn: schema_1.products.descEn,
                        price: schema_1.products.price,
                    })
                        .from(schema_1.products)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.status, 'active'), (0, drizzle_orm_1.inArray)(schema_1.products.id, productIds)));
                    if (rows.length > 0) {
                        // 按相似度排序
                        const rowMap = new Map(rows.map((r) => [r.id, r]));
                        const result = [];
                        for (const s of similar) {
                            const row = rowMap.get(s.productId);
                            if (row) {
                                result.push({
                                    id: row.id,
                                    titleEn: row.titleEn,
                                    descEn: row.descEn,
                                    price: String(row.price),
                                });
                            }
                        }
                        return result;
                    }
                }
            }
            catch (error) {
                // 向量检索失败，静默回退到关键词匹配
            }
        }
        // 回退：关键词匹配
        // 判断是否包含商品相关词汇
        const productKeywords = ['product', '商品', '产品', 'item', '商品详情', '规格', 'spec', '多少钱', 'price', '价格'];
        const lowerQuery = query.toLowerCase();
        const isProductRelated = productKeywords.some((kw) => lowerQuery.includes(kw.toLowerCase()));
        if (!isProductRelated) {
            return [];
        }
        try {
            const rows = await this.db
                .select({
                id: schema_1.products.id,
                titleEn: schema_1.products.titleEn,
                descEn: schema_1.products.descEn,
                price: schema_1.products.price,
            })
                .from(schema_1.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.status, 'active'), (0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.products.titleEn, `%${query}%`), (0, drizzle_orm_1.ilike)(schema_1.products.titleZh, `%${query}%`), (0, drizzle_orm_1.ilike)(schema_1.products.descEn, `%${query}%`))))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.products.sold))
                .limit(5);
            return rows.map((row) => ({
                id: row.id,
                titleEn: row.titleEn,
                descEn: row.descEn,
                price: String(row.price),
            }));
        }
        catch {
            return [];
        }
    }
    matchFaqs(queryLower) {
        return SHOP_FAQS.filter((faq) => faq.keywords.some((kw) => queryLower.includes(kw.toLowerCase())));
    }
    async getOrderInfo(orderNo) {
        try {
            const [order] = await this.db
                .select({
                orderNo: schema_1.orders.orderNo,
                status: schema_1.orders.status,
                totalAmount: schema_1.orders.totalAmount,
                trackingNo: schema_1.orders.trackingNumber,
                createdAt: schema_1.orders.createdAt,
                shippedAt: schema_1.orders.shippedAt,
            })
                .from(schema_1.orders)
                .where((0, drizzle_orm_1.eq)(schema_1.orders.orderNo, orderNo))
                .limit(1);
            if (!order) {
                return `订单号 ${orderNo} 未找到。`;
            }
            const statusMap = {
                pending_payment: '待付款',
                paid: '已付款，待发货',
                shipped: '已发货',
                delivered: '已送达',
                cancelled: '已取消',
            };
            return [
                `订单号: ${order.orderNo}`,
                `状态: ${statusMap[order.status] || order.status}`,
                `金额: $${order.totalAmount}`,
                order.trackingNo ? `运单号: ${order.trackingNo}` : '',
                order.shippedAt ? `发货时间: ${order.shippedAt.toISOString()}` : '',
            ].filter(Boolean).join('\n');
        }
        catch {
            return '';
        }
    }
    async getHistoryMessages(sessionId) {
        try {
            const rows = await this.db
                .select({
                role: schema_1.inquiryMessages.role,
                content: schema_1.inquiryMessages.content,
            })
                .from(schema_1.inquiryMessages)
                .where((0, drizzle_orm_1.eq)(schema_1.inquiryMessages.sessionId, sessionId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.inquiryMessages.createdAt))
                .limit(10);
            // 按时间升序排列，且只保留 user/assistant 角色
            return rows
                .reverse()
                .filter((row) => row.role === 'user' || row.role === 'assistant')
                .map((row) => ({
                role: row.role,
                content: row.content,
            }));
        }
        catch {
            return [];
        }
    }
    buildSystemPrompt(language, context) {
        const langInstruction = language === 'zh'
            ? '请用中文回复。'
            : language === 'en'
                ? 'Please reply in English.'
                : 'Please reply in the same language as the user\'s message.';
        return `你是专业的跨境电商智能客服，负责回答买家关于商品、订单、物流、售后等问题。${langInstruction}

## 回复规则
1. 基于以下上下文回答问题，不要编造上下文中不存在的信息。
2. 如果上下文中没有相关信息，请礼貌说明"暂无相关信息"或建议联系人工客服。
3. 语气友好、专业、简洁。
4. 不要假装能访问外部系统或实时数据，只能使用提供的上下文。

## 参考上下文
${context || '（暂无额外上下文）'}

请根据以上规则和上下文回答用户问题。`;
    }
};
exports.SupportService = SupportService;
exports.SupportService = SupportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, ai_gateway_service_1.AiGatewayService,
        embedding_service_1.EmbeddingService])
], SupportService);
//# sourceMappingURL=support.service.js.map