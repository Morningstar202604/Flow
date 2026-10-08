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
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const roles_guard_1 = require("@server/common/guards/roles.guard");
let OrdersController = class OrdersController {
    ordersService;
    constructor(ordersService) {
        this.ordersService = ordersService;
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
    async getOrderList(page, pageSize, status, keyword) {
        const pageNum = page ? parseInt(page, 10) : 1;
        const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
        const safePage = Math.max(1, pageNum);
        const safePageSize = Math.min(50, Math.max(1, pageSizeNum));
        return this.ordersService.getOrderList(safePage, safePageSize, status, keyword);
    }
    async getBuyerOrders(req, page, pageSize) {
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req);
        if (!userId && !sessionId) {
            return { items: [], total: 0, page: 1, pageSize: 10 };
        }
        const pageNum = page ? parseInt(page, 10) : 1;
        const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
        const safePage = Math.max(1, pageNum);
        const safePageSize = Math.min(50, Math.max(1, pageSizeNum));
        return this.ordersService.getBuyerOrders(userId, sessionId, safePage, safePageSize);
    }
    async getSellerOrderDetail(id) {
        return this.ordersService.getOrderDetail(id, undefined, undefined, true);
    }
    async getOrderDetail(req, id) {
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req);
        const isSeller = !!req.user && ['seller', 'admin'].includes(req.user.role);
        return this.ordersService.getOrderDetail(id, userId, sessionId, isSeller);
    }
    async createOrder(req, dto) {
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req);
        const ip = this.getClientIp(req);
        return this.ordersService.createOrder(dto, userId, sessionId, { ip });
    }
    async updateStatus(req, id, dto) {
        const userId = req.user?.id;
        const role = req.user?.role;
        const ip = this.getClientIp(req);
        return this.ordersService.updateStatus(id, dto, userId, role, ip);
    }
    async cancelOrder(req, id) {
        const userId = req.user?.id;
        const sessionId = this.getSessionId(req);
        const ip = this.getClientIp(req);
        await this.ordersService.getOrderDetail(id, userId, sessionId);
        return this.ordersService.updateStatus(id, { status: 'cancelled' }, userId, userId ? req.user?.role : undefined, ip);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('keyword')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getOrderList", null);
__decorate([
    (0, common_1.Get)('buyer'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getBuyerOrders", null);
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    (0, common_1.Get)('seller/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getSellerOrderDetail", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getOrderDetail", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "createOrder", null);
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "cancelOrder", null);
exports.OrdersController = OrdersController = __decorate([
    (0, common_1.Controller)('api/orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map