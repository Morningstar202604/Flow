import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CartModule } from '../cart/cart.module';
import { CategoriesModule } from '../categories/categories.module';
import { ShopperController } from './shopper.controller';
import { ShopperAnalyticsService } from './shopper-analytics.service';
import { ShopperService } from './shopper.service';
import { ShopperToolService } from './shopper-tool.service';

@Module({
  imports: [AiModule, CartModule, CategoriesModule],
  controllers: [ShopperController],
  providers: [ShopperService, ShopperToolService, ShopperAnalyticsService],
  exports: [ShopperAnalyticsService],
})
export class ShopperModule {}
