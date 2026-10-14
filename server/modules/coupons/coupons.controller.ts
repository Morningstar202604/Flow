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
} from '@nestjs/common';
import type { Request } from 'express';

import { RolesGuard } from '../../common/guards/roles.guard';
import { CouponsService } from './coupons.service';
import type {
  Coupon,
  CouponListResponse,
  ValidateCouponResponse,
} from '../../../shared/api.interface';
import { CreateCouponDto, GenerateBulkCodesDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupons.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  /** 客户端 IP：取 req.ip（反代场景由 TRUST_PROXY 控制可信来源），不直接信任 XFF */
  private getClientIp(req: Request): string {
    return req.ip ?? 'unknown';
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
  async create(@Req() req: Request, @Body() body: CreateCouponDto): Promise<Coupon> {
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
    @Body() body: UpdateCouponDto,
  ): Promise<Coupon> {
    return this.couponsService.update(id, body);
  }

  @Post('generate-bulk')
  @UseGuards(new RolesGuard(['seller', 'admin']))
  async generateBulk(
    @Req() req: Request,
    @Body() body: GenerateBulkCodesDto,
  ): Promise<{ codes: string[] }> {
    const userId = req.user?.id;
    const role = req.user?.role;
    const ip = this.getClientIp(req);
    const codes = await this.couponsService.generateBulkCodes(body.baseCode, body.count, {
      userId,
      role,
      ip,
    });
    return { codes };
  }

  @Post('validate')
  async validate(@Body() body: ValidateCouponDto): Promise<ValidateCouponResponse> {
    return this.couponsService.validate(body.code, String(body.orderAmount));
  }
}
