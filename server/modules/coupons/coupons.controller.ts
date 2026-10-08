import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { RolesGuard } from '@server/common/guards/roles.guard';
import { CouponsService } from './coupons.service';
import type {
  Coupon,
  CouponListResponse,
  CreateCouponRequest,
  UpdateCouponRequest,
  ValidateCouponRequest,
  ValidateCouponResponse,
} from '@shared/api.interface';

@Controller('api/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  private getClientIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) {
      return xff.split(',')[0].trim();
    }
    const ip = req.socket?.remoteAddress;
    return ip || 'unknown';
  }

  @Get()
  @UseGuards(new RolesGuard(['seller', 'admin']))
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<CouponListResponse> {
    return this.couponsService.list(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Post()
  @UseGuards(new RolesGuard(['seller', 'admin']))
  async create(@Req() req: Request, @Body() body: CreateCouponRequest): Promise<Coupon> {
    const userId = req.user?.id;
    const role = req.user?.role;
    const ip = this.getClientIp(req);
    return this.couponsService.create(body, {
      userId: userId,
      role: role,
      ip,
    });
  }

  @Patch(':id')
  @UseGuards(new RolesGuard(['seller', 'admin']))
  async update(
    @Param('id') id: string,
    @Body() body: UpdateCouponRequest,
  ): Promise<Coupon> {
    return this.couponsService.update(id, body);
  }

  @Post('validate')
  async validate(@Body() body: ValidateCouponRequest): Promise<ValidateCouponResponse> {
    if (!body.code) {
      throw new BadRequestException('请输入优惠码');
    }
    if (body.orderAmount == null || isNaN(body.orderAmount)) {
      throw new BadRequestException('订单金额无效');
    }
    return this.couponsService.validate(body.code, String(body.orderAmount));
  }
}
