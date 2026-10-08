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
exports.TranslationService = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("./ai-gateway.service");
let TranslationService = class TranslationService {
    aiGateway;
    constructor(aiGateway) {
        this.aiGateway = aiGateway;
    }
    async translate(dto, userId) {
        const sourceLang = dto.sourceLang ? this.getLangName(dto.sourceLang) : '自动检测';
        const targetLang = this.getLangName(dto.targetLang);
        const systemPrompt = '你是专业的多语言翻译专家，擅长跨境电商场景下的精准翻译。请直接输出翻译结果，不要添加任何解释或标记。';
        const userPrompt = `请将以下文本从${sourceLang}翻译为${targetLang}：

${dto.text}`;
        const { content } = await this.aiGateway.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ], { temperature: 0.3, maxTokens: 2000, agent: 'translation', userId });
        return { translatedText: content.trim() };
    }
    getLangName(code) {
        const map = {
            zh: '中文',
            en: '英文',
            ja: '日文',
            ko: '韩文',
            fr: '法文',
            de: '德文',
            es: '西班牙文',
            pt: '葡萄牙文',
            it: '意大利文',
            ru: '俄文',
            ar: '阿拉伯文',
        };
        return map[code] || code;
    }
};
exports.TranslationService = TranslationService;
exports.TranslationService = TranslationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AiGatewayService])
], TranslationService);
//# sourceMappingURL=translation.service.js.map