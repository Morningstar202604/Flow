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
exports.InquiryController = void 0;
const common_1 = require("@nestjs/common");
const roles_guard_1 = require("@server/common/guards/roles.guard");
const inquiry_service_1 = require("./inquiry.service");
let InquiryController = class InquiryController {
    inquiryService;
    constructor(inquiryService) {
        this.inquiryService = inquiryService;
    }
    async getSessions(page, pageSize, status) {
        const pageNum = page ? parseInt(page, 10) : 1;
        const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
        if (pageNum < 1 || pageSizeNum < 1) {
            throw new common_1.BadRequestException('分页参数非法');
        }
        return this.inquiryService.getSessions(pageNum, pageSizeNum, status);
    }
    async getMessages(req, sessionId) {
        const isSeller = !!req.user && ['seller', 'admin'].includes(req.user.role);
        if (!isSeller) {
            const raw = req.headers['x-session-id'];
            const headerSessionId = Array.isArray(raw) ? raw[0] : raw;
            if (!headerSessionId || headerSessionId !== sessionId) {
                throw new common_1.ForbiddenException('无权访问该会话');
            }
        }
        return this.inquiryService.getMessages(sessionId);
    }
    async sendMessage(req, body) {
        if (body.role === 'seller') {
            if (!req.user || !['seller', 'admin'].includes(req.user.role)) {
                throw new common_1.ForbiddenException('卖家身份需要登录且具备卖家权限');
            }
            return this.inquiryService.sendMessage(body, req.user.id);
        }
        const raw = req.headers['x-session-id'];
        const headerSessionId = Array.isArray(raw) ? raw[0] : raw;
        if (!headerSessionId || headerSessionId !== body.sessionId) {
            throw new common_1.ForbiddenException('无权向该会话发送消息');
        }
        return this.inquiryService.sendMessage(body);
    }
    async createSession(body) {
        if (!body.sessionId) {
            throw new common_1.BadRequestException('sessionId 不能为空');
        }
        return this.inquiryService.createSession(body.sessionId, body.userId);
    }
};
exports.InquiryController = InquiryController;
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['seller', 'admin'])),
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "getSessions", null);
__decorate([
    (0, common_1.Get)('sessions/:sessionId/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('sessions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InquiryController.prototype, "createSession", null);
exports.InquiryController = InquiryController = __decorate([
    (0, common_1.Controller)('api/inquiry'),
    __metadata("design:paramtypes", [inquiry_service_1.InquiryService])
], InquiryController);
//# sourceMappingURL=inquiry.controller.js.map