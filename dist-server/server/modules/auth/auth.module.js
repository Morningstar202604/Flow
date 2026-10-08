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
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const jwt_auth_middleware_1 = require("@server/common/middleware/jwt-auth.middleware");
const isProd = process.env.NODE_ENV === 'production';
const DEFAULT_DEV_SECRET = 'globalecom-dev-jwt-secret-change-in-production';
function resolveJwtSecret() {
    const envSecret = process.env.JWT_SECRET;
    if (envSecret && envSecret.length >= 32) {
        return envSecret;
    }
    if (isProd) {
        throw new Error('FATAL: JWT_SECRET environment variable is required in production and must be at least 32 characters. Refusing to start.');
    }
    const logger = new common_1.Logger('AuthModule');
    if (!envSecret) {
        logger.warn('⚠️  JWT_SECRET not set, using insecure dev default. This is ONLY acceptable in development. Set JWT_SECRET before deploying to production.');
    }
    else {
        logger.warn('⚠️  JWT_SECRET is too short (less than 32 chars). Using dev default for development only.');
    }
    return DEFAULT_DEV_SECRET;
}
const JWT_SECRET = resolveJwtSecret();
let AuthModule = class AuthModule {
    constructor() {
        const logger = new common_1.Logger('AuthModule');
        if (isProd) {
            logger.log('JWT_SECRET loaded for production.');
        }
    }
    configure(consumer) {
        consumer
            .apply(jwt_auth_middleware_1.JwtAuthMiddleware)
            .forRoutes({ path: 'api/auth/me', method: common_1.RequestMethod.ALL }, { path: 'api/auth/refresh', method: common_1.RequestMethod.ALL }, { path: 'api/auth/merge-cart', method: common_1.RequestMethod.ALL }, { path: 'api/auth/logout', method: common_1.RequestMethod.ALL }, { path: 'api/cart', method: common_1.RequestMethod.ALL }, { path: 'api/cart/items', method: common_1.RequestMethod.ALL }, { path: 'api/cart/items/:id', method: common_1.RequestMethod.ALL }, { path: 'api/cart/export-code', method: common_1.RequestMethod.ALL }, { path: 'api/cart/import-code', method: common_1.RequestMethod.ALL }, { path: 'api/orders', method: common_1.RequestMethod.ALL }, { path: 'api/orders/seller', method: common_1.RequestMethod.ALL }, { path: 'api/orders/seller/:id', method: common_1.RequestMethod.ALL }, { path: 'api/orders/:id', method: common_1.RequestMethod.ALL }, { path: 'api/orders/:id/status', method: common_1.RequestMethod.ALL }, { path: 'api/orders/:id/cancel', method: common_1.RequestMethod.ALL }, { path: 'api/dashboard/stats', method: common_1.RequestMethod.ALL }, { path: 'api/products/manage', method: common_1.RequestMethod.ALL }, { path: 'api/products/import', method: common_1.RequestMethod.ALL }, { path: 'api/products/import-template', method: common_1.RequestMethod.ALL }, { path: 'api/products/featured', method: common_1.RequestMethod.ALL }, { path: 'api/products', method: common_1.RequestMethod.POST }, { path: 'api/products/:id', method: common_1.RequestMethod.PATCH }, { path: 'api/products/:id', method: common_1.RequestMethod.DELETE }, { path: 'api/products/:id/status', method: common_1.RequestMethod.ALL }, { path: 'api/products/:id/reviews', method: common_1.RequestMethod.ALL }, { path: 'api/inquiry/sessions', method: common_1.RequestMethod.ALL }, { path: 'api/inquiry/sessions/:id', method: common_1.RequestMethod.ALL }, { path: 'api/inquiry/sessions/:id/messages', method: common_1.RequestMethod.ALL }, { path: 'api/inquiry/assign', method: common_1.RequestMethod.ALL }, { path: 'api/ai/copywriter', method: common_1.RequestMethod.ALL }, { path: 'api/ai/support', method: common_1.RequestMethod.ALL }, { path: 'api/ai/trend', method: common_1.RequestMethod.ALL }, { path: 'api/ai/select', method: common_1.RequestMethod.ALL }, { path: 'api/ai/translation', method: common_1.RequestMethod.ALL }, { path: 'api/ai/status', method: common_1.RequestMethod.ALL }, { path: 'api/categories', method: common_1.RequestMethod.POST }, { path: 'api/categories/:id', method: common_1.RequestMethod.PATCH }, { path: 'api/categories/:id', method: common_1.RequestMethod.DELETE }, { path: 'api/favorites', method: common_1.RequestMethod.ALL }, { path: 'api/favorites/:productId', method: common_1.RequestMethod.ALL }, { path: 'api/coupons', method: common_1.RequestMethod.ALL }, { path: 'api/coupons/:id', method: common_1.RequestMethod.ALL }, { path: 'api/coupons/validate', method: common_1.RequestMethod.ALL }, { path: 'api/logistics', method: common_1.RequestMethod.ALL }, { path: 'api/logistics/:id', method: common_1.RequestMethod.ALL }, { path: 'api/payments', method: common_1.RequestMethod.ALL }, { path: 'api/payments/pay', method: common_1.RequestMethod.ALL }, { path: 'api/payments/:id', method: common_1.RequestMethod.ALL }, { path: 'api/audit-logs', method: common_1.RequestMethod.ALL }, { path: 'api/audit-logs/:id', method: common_1.RequestMethod.ALL });
    }
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.register({
                secret: JWT_SECRET,
                signOptions: { expiresIn: '2h' },
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService],
        exports: [auth_service_1.AuthService, jwt_1.JwtModule],
    }),
    __metadata("design:paramtypes", [])
], AuthModule);
//# sourceMappingURL=auth.module.js.map