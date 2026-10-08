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
exports.SelectService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_provider_1 = require("../../database/database.provider");
const ai_gateway_service_1 = require("./ai-gateway.service");
const schema_1 = require("@server/database/schema");
let SelectService = class SelectService {
    db;
    aiGateway;
    constructor(db, aiGateway) {
        this.db = db;
        this.aiGateway = aiGateway;
    }
    async selectProducts(userId) {
        const allCategories = await this.db.select({
            id: schema_1.categories.id,
            nameZh: schema_1.categories.nameZh,
            nameEn: schema_1.categories.nameEn,
        }).from(schema_1.categories);
        const topProducts = await this.db
            .select({
            id: schema_1.products.id,
            titleEn: schema_1.products.titleEn,
            categoryId: schema_1.products.categoryId,
            sold: schema_1.products.sold,
            price: schema_1.products.price,
            stock: schema_1.products.stock,
        })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.status, 'active'))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.products.sold))
            .limit(20);
        const stockLevels = topProducts.map((p) => ({
            titleEn: p.titleEn,
            stock: p.stock,
            price: String(p.price),
        }));
        const dataContext = JSON.stringify({
            categories: allCategories,
            topProducts: stockLevels,
        }, null, 2);
        const systemPrompt = '你是专业的跨境电商选品专家，擅长基于销售数据和市场趋势给出选品建议。请用中文输出严格的 JSON 格式。';
        const userPrompt = `基于以下店铺现有类目和销售数据，推荐 5-8 个值得上架的细分品。

## 现有数据
${dataContext}

## 输出格式要求
请返回严格的 JSON 格式，结构如下：
{
  "items": [
    {
      "keyword": "细分品关键词",
      "estimatedDemand": "预估市场需求描述（如\"高\"、\"中\"、\"低\"）",
      "suggestedPriceRange": "建议售价区间（如 \"$19.99 - $29.99\"）",
      "reason": "推荐理由（2-3句话）",
      "confidence": 0.85
    }
  ]
}

confidence 是 0-1 之间的数字，表示推荐置信度。
每个细分品应有差异化定位，避免同质化推荐。`;
        const { content } = await this.aiGateway.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ], { temperature: 0.8, maxTokens: 2000, responseFormat: 'json', agent: 'select', userId });
        const parsed = JSON.parse(content);
        return {
            items: Array.isArray(parsed.items) ? parsed.items : [],
        };
    }
};
exports.SelectService = SelectService;
exports.SelectService = SelectService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, ai_gateway_service_1.AiGatewayService])
], SelectService);
//# sourceMappingURL=select.service.js.map