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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopywriterService = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("./ai-gateway.service");
let CopywriterService = class CopywriterService {
    aiGateway;
    constructor(aiGateway) {
        this.aiGateway = aiGateway;
    }
    async generate(dto, userId) {
        const systemPrompt = '你是专业的跨境电商文案专家，擅长为英文市场撰写有吸引力的商品文案。请用英文输出。';
        const userPrompt = `基于以下商品信息生成电商商品文案，要求返回严格的 JSON 格式：
- 商品中文名：${dto.productNameZh}
- 规格参数：${dto.specs || '未提供'}
- 类目：${dto.category || '未提供'}
- 目标市场：${dto.targetMarket || '北美市场'}

请输出以下 JSON 结构：
{
  "titleEn": "英文商品标题，不超过80字符，包含核心关键词",
  "bulletPoints": ["5条卖点描述，每条不超过150字符"],
  "longDescription": "详细商品描述，300-500字",
  "seoKeywords": "SEO关键词，用逗号分隔"
}`;
        const { content } = await this.aiGateway.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ], { temperature: 0.8, maxTokens: 1500, responseFormat: 'json', agent: 'copywriter', userId });
        const parsed = JSON.parse(content);
        return {
            titleEn: parsed.titleEn || '',
            bulletPoints: Array.isArray(parsed.bulletPoints) ? parsed.bulletPoints : [],
            longDescription: parsed.longDescription || '',
            seoKeywords: parsed.seoKeywords || '',
        };
    }
};
exports.CopywriterService = CopywriterService;
exports.CopywriterService = CopywriterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AiGatewayService])
], CopywriterService);
//# sourceMappingURL=copywriter.service.js.map