import { Module } from '@nestjs/common';

import { ShippingController } from './shipping.controller';
import { ShippingQuoteController } from './shipping-quote.controller';
import { ShippingService } from './shipping.service';

@Module({
  controllers: [ShippingController, ShippingQuoteController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
