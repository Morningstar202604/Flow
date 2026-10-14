import { Controller, Get, Query, BadRequestException } from '@nestjs/common';

import { ShippingService } from './shipping.service';

/**
 * 买家结算页运费报价（公开接口）。
 * 报价仅供展示，下单时服务端会用同一计算口径重算并以订单为准。
 */
@Controller('shipping')
export class ShippingQuoteController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('quote')
  async quote(
    @Query('subtotal') subtotal?: string,
    @Query('qtyTotal') qtyTotal?: string,
    @Query('weightTotal') weightTotal?: string,
    @Query('country') country?: string,
  ) {
    const subtotalNum = Number(subtotal ?? '0');
    if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
      throw new BadRequestException('subtotal 参数非法');
    }

    const qty = qtyTotal !== undefined ? Number(qtyTotal) : undefined;
    const weight = weightTotal !== undefined ? Number(weightTotal) : undefined;
    if ((qty !== undefined && (!Number.isFinite(qty) || qty < 0)) ||
        (weight !== undefined && (!Number.isFinite(weight) || weight < 0))) {
      throw new BadRequestException('数量/重量参数非法');
    }

    return this.shippingService.quoteForBuyer({
      country: country?.trim().slice(0, 100) || undefined,
      qtyTotal: qty,
      weightTotal: weight,
      subtotal: subtotalNum,
    });
  }
}
