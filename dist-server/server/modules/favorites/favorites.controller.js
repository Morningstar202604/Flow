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
exports.FavoritesController = void 0;
const common_1 = require("@nestjs/common");
const roles_guard_1 = require("@server/common/guards/roles.guard");
const favorites_service_1 = require("./favorites.service");
let FavoritesController = class FavoritesController {
    favoritesService;
    constructor(favoritesService) {
        this.favoritesService = favoritesService;
    }
    async getMyFavorites(req) {
        const userId = req.user?.id;
        return this.favoritesService.getMyFavorites(userId);
    }
    async toggle(req, productId) {
        const userId = req.user?.id;
        return this.favoritesService.toggle(productId, userId);
    }
    async check(req, productId) {
        const userId = req.user?.id;
        const favorited = await this.favoritesService.isFavorited(productId, userId);
        return { favorited };
    }
    async checkBatch(req, productIds) {
        const userId = req.user?.id;
        if (!productIds) {
            throw new common_1.BadRequestException('productIds 不能为空');
        }
        const ids = productIds.split(',').filter(Boolean);
        if (ids.length === 0) {
            return { favoritedIds: [] };
        }
        const favoritedIds = await this.favoritesService.isFavoritedBatch(ids, userId);
        return { favoritedIds };
    }
};
exports.FavoritesController = FavoritesController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['buyer', 'seller', 'admin'])),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FavoritesController.prototype, "getMyFavorites", null);
__decorate([
    (0, common_1.Post)(':productId'),
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['buyer', 'seller', 'admin'])),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FavoritesController.prototype, "toggle", null);
__decorate([
    (0, common_1.Get)('check/:productId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FavoritesController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('check-batch'),
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['buyer', 'seller', 'admin'])),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('productIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FavoritesController.prototype, "checkBatch", null);
exports.FavoritesController = FavoritesController = __decorate([
    (0, common_1.Controller)('api/favorites'),
    __metadata("design:paramtypes", [favorites_service_1.FavoritesService])
], FavoritesController);
//# sourceMappingURL=favorites.controller.js.map