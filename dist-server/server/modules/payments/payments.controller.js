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
var PaymentsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const payments_service_1 = require("./payments.service");
const common_2 = require("@nestjs/common");
let PaymentsController = PaymentsController_1 = class PaymentsController {
    paymentsService;
    logger = new common_1.Logger(PaymentsController_1.name);
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    getSessionId(req) {
        const raw = req.headers['x-session-id'];
        const sessionId = Array.isArray(raw) ? raw[0] : raw;
        if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
            return sessionId.trim();
        }
        return undefined;
    }
    getClientIp(req) {
        const xff = req.headers['x-forwarded-for'];
        if (typeof xff === 'string' && xff) {
            return xff.split(',')[0].trim();
        }
        const ip = req.socket?.remoteAddress;
        return ip || 'unknown';
    }
    async pay(req, body) {
        if (!body.orderId) {
            throw new common_1.BadRequestException('缺少订单ID');
        }
        if (!body.provider) {
            throw new common_1.BadRequestException('缺少支付方式');
        }
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req);
        const ip = this.getClientIp(req);
        if (!userId && !sessionId) {
            throw new common_2.ForbiddenException('请先登录或初始化会话');
        }
        return this.paymentsService.pay(body.orderId, body.provider, userId, sessionId, { ip });
    }
    async getConfig() {
        return this.paymentsService.getPaymentConfig();
    }
    async handlePayPalWebhook(req, headers, body) {
        const result = await this.paymentsService.handlePayPalWebhook(headers, body);
        if (!result) {
            throw new common_1.BadRequestException('无效的 PayPal webhook 请求');
        }
        return { received: true };
    }
    async getPaymentsByOrder(req, orderId) {
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req);
        const isSeller = !!req.user && ['seller', 'admin'].includes(req.user.role);
        return this.paymentsService.getPaymentsByOrder(orderId, userId, sessionId, isSeller);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)('pay'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "pay", null);
__decorate([
    (0, common_1.Get)('config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Post)('paypal-webhook'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "handlePayPalWebhook", null);
__decorate([
    (0, common_1.Get)('order/:orderId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getPaymentsByOrder", null);
exports.PaymentsController = PaymentsController = PaymentsController_1 = __decorate([
    (0, common_1.Controller)('api/payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map