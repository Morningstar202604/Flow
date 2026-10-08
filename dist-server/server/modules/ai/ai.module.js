"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const ai_controller_1 = require("./ai.controller");
const ai_gateway_service_1 = require("./ai-gateway.service");
const copywriter_service_1 = require("./copywriter.service");
const support_service_1 = require("./support.service");
const trend_service_1 = require("./trend.service");
const select_service_1 = require("./select.service");
const translation_service_1 = require("./translation.service");
const embedding_module_1 = require("../embedding/embedding.module");
let AiModule = class AiModule {
};
exports.AiModule = AiModule;
exports.AiModule = AiModule = __decorate([
    (0, common_1.Module)({
        imports: [axios_1.HttpModule, embedding_module_1.EmbeddingModule],
        controllers: [ai_controller_1.AiController],
        providers: [
            ai_gateway_service_1.AiGatewayService,
            copywriter_service_1.CopywriterService,
            support_service_1.SupportService,
            trend_service_1.TrendService,
            select_service_1.SelectService,
            translation_service_1.TranslationService,
        ],
    })
], AiModule);
//# sourceMappingURL=ai.module.js.map