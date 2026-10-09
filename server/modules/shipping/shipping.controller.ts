import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { ShippingService } from './shipping.service';
import { RolesGuard } from '@server/common/guards/roles.guard';

@Controller('api/shipping-templates')
@UseGuards(new RolesGuard(['seller', 'admin']))
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: Record<string, unknown>) {
    const sellerId = req.user?.id as string;
    return this.shippingService.create(sellerId, dto as {
      name: string;
      freeShippingThreshold?: string;
      baseFee?: string;
      extraFeePerUnit?: string;
      unitType?: string;
      specialZones?: string;
      isDefault?: boolean;
    });
  }

  @Get()
  async list(@Req() req: Request) {
    const sellerId = req.user?.id as string;
    return this.shippingService.list(sellerId);
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const sellerId = req.user?.id as string;
    return this.shippingService.getOne(id, sellerId);
  }

  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    const sellerId = req.user?.id as string;
    return this.shippingService.update(id, sellerId, dto as {
      name?: string;
      freeShippingThreshold?: string;
      baseFee?: string;
      extraFeePerUnit?: string;
      unitType?: string;
      specialZones?: string;
      isDefault?: boolean;
    });
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const sellerId = req.user?.id as string;
    return this.shippingService.remove(id, sellerId);
  }

  @Post('calculate')
  async calculate(@Body() body: {
    sellerId: string;
    country?: string;
    weightTotal?: number;
    qtyTotal?: number;
    subtotal?: number;
  }) {
    const { sellerId, country = '', weightTotal = 0, qtyTotal = 0, subtotal = 0 } = body;
    const fee = await this.shippingService.calculateShipping(
      sellerId,
      country,
      weightTotal,
      qtyTotal,
      subtotal,
    );
    return { shippingFee: fee };
  }
}
