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
exports.CartController = void 0;
const common_1 = require("@nestjs/common");
const cart_service_1 = require("./cart.service");
let CartController = class CartController {
    cartService;
    constructor(cartService) {
        this.cartService = cartService;
    }
    getSessionId(headers) {
        const raw = headers['x-session-id'];
        const sessionId = Array.isArray(raw) ? raw[0] : raw;
        if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
            return sessionId.trim();
        }
        return undefined;
    }
    async getCart(req) {
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req.headers);
        return this.cartService.getCart(userId, sessionId);
    }
    async addItem(req, body) {
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req.headers);
        return this.cartService.addItem(userId, sessionId, body.productId, body.quantity);
    }
    async updateItem(req, id, body) {
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req.headers);
        return this.cartService.updateItem(userId, sessionId, id, body.quantity);
    }
    async removeItem(req, id) {
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req.headers);
        return this.cartService.removeItem(userId, sessionId, id);
    }
    async exportCode(req) {
        const sessionId = this.getSessionId(req.headers);
        if (!sessionId) {
            throw new common_1.BadRequestException('无法识别会话');
        }
        return this.cartService.exportRecoveryCode(sessionId);
    }
    async importCode(req, body) {
        const sessionId = this.getSessionId(req.headers);
        if (!sessionId) {
            throw new common_1.BadRequestException('无法识别会话');
        }
        return this.cartService.importRecoveryCode(sessionId, body.code);
    }
};
exports.CartController = CartController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "getCart", null);
__decorate([
    (0, common_1.Post)('items'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "addItem", null);
__decorate([
    (0, common_1.Patch)('items/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "updateItem", null);
__decorate([
    (0, common_1.Delete)('items/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "removeItem", null);
__decorate([
    (0, common_1.Get)('export-code'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "exportCode", null);
__decorate([
    (0, common_1.Post)('import-code'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "importCode", null);
exports.CartController = CartController = __decorate([
    (0, common_1.Controller)('api/cart'),
    __metadata("design:paramtypes", [cart_service_1.CartService])
], CartController);
//# sourceMappingURL=cart.controller.js.map