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
exports.LogisticsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_guard_1 = require("@server/common/guards/roles.guard");
const logistics_service_1 = require("./logistics.service");
class RegisterTrackingDto {
    orderId;
    carrier;
    trackingNumber;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterTrackingDto.prototype, "orderId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterTrackingDto.prototype, "carrier", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterTrackingDto.prototype, "trackingNumber", void 0);
let LogisticsController = class LogisticsController {
    logisticsService;
    constructor(logisticsService) {
        this.logisticsService = logisticsService;
    }
    async getTracking(req, orderId) {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (userRole === 'seller' || userRole === 'admin') {
            return this.logisticsService.getTrackingInfo(orderId);
        }
        const sessionId = this.extractSessionId(req);
        if (userId || sessionId) {
            await this.logisticsService.verifyOrderOwnership(orderId, userId, sessionId);
        }
        else {
            throw new common_1.BadRequestException('请提供用户身份或会话ID');
        }
        return this.logisticsService.getTrackingInfo(orderId);
    }
    async registerTracking(dto) {
        return this.logisticsService.registerTracking(dto.orderId, dto.carrier, dto.trackingNumber);
    }
    extractSessionId(req) {
        const header = req.headers['x-session-id'];
        if (typeof header === 'string' && header)
            return header;
        if (Array.isArray(header) && header.length > 0)
            return header[0];
        const query = req.query.sessionId;
        if (typeof query === 'string' && query)
            return query;
        return undefined;
    }
};
exports.LogisticsController = LogisticsController;
__decorate([
    (0, common_1.Get)(':orderId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LogisticsController.prototype, "getTracking", null);
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RegisterTrackingDto]),
    __metadata("design:returntype", Promise)
], LogisticsController.prototype, "registerTracking", null);
exports.LogisticsController = LogisticsController = __decorate([
    (0, common_1.Controller)('api/logistics'),
    __metadata("design:paramtypes", [logistics_service_1.LogisticsService])
], LogisticsController);
//# sourceMappingURL=logistics.controller.js.map