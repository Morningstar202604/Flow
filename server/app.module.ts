import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { databaseProvider } from './database/database.provider';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiModule } from './modules/ai/ai.module';
import { AuditModule } from './modules/audit/audit.module';
import { InquiryModule } from './modules/inquiry/inquiry.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { HelloModule } from './modules/hello/hello.module';
import { JwtAuthMiddleware } from './common/middleware/jwt-auth.middleware';
import { ViewModule } from './modules/view/view.module';

const businessModules = [
  AuthModule,
  AiModule,
  AuditModule,
  CartModule,
  CategoriesModule,
  CouponsModule,
  DashboardModule,
  EmbeddingModule,
  FavoritesModule,
  HelloModule,
  InquiryModule,
  LogisticsModule,
  OrdersModule,
  PaymentsModule,
  ProductsModule,
  ReviewsModule,
  ViewModule,
];

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    ...businessModules,
  ],
  providers: [
    databaseProvider,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(JwtAuthMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
