import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CouponsModule } from '../coupons/coupons.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { InquiryModule } from '../inquiry/inquiry.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { RefundsModule } from '../refunds/refunds.module';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { CopilotToolService } from './copilot-tool.service';

@Module({
  imports: [
    AiModule,
    CouponsModule,
    DashboardModule,
    InquiryModule,
    OrdersModule,
    ProductsModule,
    RefundsModule,
  ],
  controllers: [CopilotController],
  providers: [CopilotService, CopilotToolService],
  exports: [CopilotService],
})
export class CopilotModule {}
