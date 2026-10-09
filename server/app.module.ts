import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { databaseProvider } from './database/database.provider';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CmsModule } from './modules/cms/cms.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiModule } from './modules/ai/ai.module';
import { AuditModule } from './modules/audit/audit.module';
import { InquiryModule } from './modules/inquiry/inquiry.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { JwtAuthMiddleware } from './common/middleware/jwt-auth.middleware';

const businessModules = [
  AuthModule,
  AddressesModule,
  AiModule,
  AuditModule,
  CartModule,
  CategoriesModule,
  CmsModule,
  CouponsModule,
  DashboardModule,
  FavoritesModule,
  InquiryModule,
  LogisticsModule,
  OrdersModule,
  PaymentsModule,
  ProductsModule,
  RefundsModule,
  ReviewsModule,
  ShippingModule,
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
