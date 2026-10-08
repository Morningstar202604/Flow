"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const database_provider_1 = require("./database/database.provider");
const auth_module_1 = require("./modules/auth/auth.module");
const products_module_1 = require("./modules/products/products.module");
const categories_module_1 = require("./modules/categories/categories.module");
const cart_module_1 = require("./modules/cart/cart.module");
const orders_module_1 = require("./modules/orders/orders.module");
const payments_module_1 = require("./modules/payments/payments.module");
const reviews_module_1 = require("./modules/reviews/reviews.module");
const favorites_module_1 = require("./modules/favorites/favorites.module");
const coupons_module_1 = require("./modules/coupons/coupons.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const ai_module_1 = require("./modules/ai/ai.module");
const audit_module_1 = require("./modules/audit/audit.module");
const inquiry_module_1 = require("./modules/inquiry/inquiry.module");
const logistics_module_1 = require("./modules/logistics/logistics.module");
const embedding_module_1 = require("./modules/embedding/embedding.module");
const hello_module_1 = require("./modules/hello/hello.module");
const jwt_auth_middleware_1 = require("./common/middleware/jwt-auth.middleware");
const view_module_1 = require("./modules/view/view.module");
const businessModules = [
    auth_module_1.AuthModule,
    ai_module_1.AiModule,
    audit_module_1.AuditModule,
    cart_module_1.CartModule,
    categories_module_1.CategoriesModule,
    coupons_module_1.CouponsModule,
    dashboard_module_1.DashboardModule,
    embedding_module_1.EmbeddingModule,
    favorites_module_1.FavoritesModule,
    hello_module_1.HelloModule,
    inquiry_module_1.InquiryModule,
    logistics_module_1.LogisticsModule,
    orders_module_1.OrdersModule,
    payments_module_1.PaymentsModule,
    products_module_1.ProductsModule,
    reviews_module_1.ReviewsModule,
    view_module_1.ViewModule,
];
let AppModule = class AppModule {
    configure(consumer) {
        consumer
            .apply(jwt_auth_middleware_1.JwtAuthMiddleware)
            .forRoutes({ path: '*', method: common_1.RequestMethod.ALL });
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            throttler_1.ThrottlerModule.forRoot([{
                    ttl: 60000,
                    limit: 100,
                }]),
            ...businessModules,
        ],
        providers: [
            database_provider_1.databaseProvider,
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map