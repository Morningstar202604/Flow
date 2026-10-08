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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const roles_guard_1 = require("@server/common/guards/roles.guard");
const ai_gateway_service_1 = require("./ai-gateway.service");
const copywriter_service_1 = require("./copywriter.service");
const support_service_1 = require("./support.service");
const trend_service_1 = require("./trend.service");
const select_service_1 = require("./select.service");
const translation_service_1 = require("./translation.service");
let AiController = class AiController {
    aiGateway;
    copywriterService;
    supportService;
    trendService;
    selectService;
    translationService;
    constructor(aiGateway, copywriterService, supportService, trendService, selectService, translationService) {
        this.aiGateway = aiGateway;
        this.copywriterService = copywriterService;
        this.supportService = supportService;
        this.trendService = trendService;
        this.selectService = selectService;
        this.translationService = translationService;
    }
    getStatus() {
        return {
            configured: this.aiGateway.isConfigured(),
            model: this.aiGateway.isConfigured() ? this.aiGateway.getModel() : undefined,
        };
    }
    async getUsageStats(agent, startDate, endDate) {
        return this.aiGateway.getUsageStats({ agent, startDate, endDate });
    }
    async copywriter(dto, req) {
        const userId = req.user?.id;
        return this.copywriterService.generate(dto, userId);
    }
    async supportChat(dto, req) {
        const userId = req.user?.id;
        return this.supportService.chat(dto, userId);
    }
    async generateTrend(req) {
        const userId = req.user?.id;
        if (!userId)
            throw new common_1.BadRequestException('用户未登录');
        return this.trendService.generateTrendReport(userId, userId);
    }
    async generateSelect(req) {
        const userId = req.user?.id;
        return this.selectService.selectProducts(userId);
    }
    async translate(dto, req) {
        const userId = req.user?.id;
        return this.translationService.translate(dto, userId);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], AiController.prototype, "getStatus", null);
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    (0, common_1.Get)('usage-stats'),
    __param(0, (0, common_1.Query)('agent')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "getUsageStats", null);
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    (0, common_1.Post)('copywriter'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "copywriter", null);
__decorate([
    (0, common_1.Post)('support/chat'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "supportChat", null);
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    (0, common_1.Post)('trend/generate'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateTrend", null);
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    (0, common_1.Post)('select/generate'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateSelect", null);
__decorate([
    (0, common_1.Post)('translate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "translate", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('api/ai'),
    __metadata("design:paramtypes", [ai_gateway_service_1.AiGatewayService,
        copywriter_service_1.CopywriterService,
        support_service_1.SupportService,
        trend_service_1.TrendService,
        select_service_1.SelectService,
        translation_service_1.TranslationService])
], AiController);
//# sourceMappingURL=ai.controller.js.map