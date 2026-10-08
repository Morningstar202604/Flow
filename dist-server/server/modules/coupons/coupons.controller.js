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
exports.CouponsController = void 0;
const common_1 = require("@nestjs/common");
const roles_guard_1 = require("@server/common/guards/roles.guard");
const coupons_service_1 = require("./coupons.service");
let CouponsController = class CouponsController {
    couponsService;
    constructor(couponsService) {
        this.couponsService = couponsService;
    }
    getClientIp(req) {
        const xff = req.headers['x-forwarded-for'];
        if (typeof xff === 'string' && xff) {
            return xff.split(',')[0].trim();
        }
        const ip = req.socket?.remoteAddress;
        return ip || 'unknown';
    }
    async list(page, pageSize) {
        return this.couponsService.list(page ? parseInt(page, 10) : 1, pageSize ? parseInt(pageSize, 10) : 20);
    }
    async create(req, body) {
        const userId = req.user?.id;
        const role = req.user?.role;
        const ip = this.getClientIp(req);
        return this.couponsService.create(body, {
            userId: userId,
            role: role,
            ip,
        });
    }
    async update(id, body) {
        return this.couponsService.update(id, body);
    }
    async validate(body) {
        if (!body.code) {
            throw new common_1.BadRequestException('请输入优惠码');
        }
        if (body.orderAmount == null || isNaN(body.orderAmount)) {
            throw new common_1.BadRequestException('订单金额无效');
        }
        return this.couponsService.validate(body.code, String(body.orderAmount));
    }
};
exports.CouponsController = CouponsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CouponsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CouponsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CouponsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('validate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CouponsController.prototype, "validate", null);
exports.CouponsController = CouponsController = __decorate([
    (0, common_1.Controller)('api/coupons'),
    __metadata("design:paramtypes", [coupons_service_1.CouponsService])
], CouponsController);
//# sourceMappingURL=coupons.controller.js.map