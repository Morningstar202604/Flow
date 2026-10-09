import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { RefundsService } from './refunds.service';
import { RolesGuard } from '@server/common/guards/roles.guard';

@Controller()
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  // ==================== Buyer Routes ====================

  /**
   * Buyer: Apply for a refund on an order
   * POST /api/orders/:orderId/refunds
   */
  @Post('api/orders/:orderId/refunds')
  async requestRefund(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Body() body: {
      amount?: string;
      reason: string;
      reasonDetail?: string;
      items?: Array<{ orderItemId: string; quantity: number }>;
      refundMethod?: string;
    },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('请先登录');
    }

    if (!body.reason?.trim()) {
      throw new BadRequestException('退款原因不能为空');
    }

    return this.refundsService.requestRefund(orderId, userId, {
      amount: body.amount,
      reason: body.reason.trim(),
      reasonDetail: body.reasonDetail,
      items: body.items,
      refundMethod: body.refundMethod,
    });
  }

  /**
   * Buyer: List own refunds
   * GET /api/my/refunds
   */
  @Get('api/my/refunds')
  async listMyRefunds(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('请先登录');
    }

    return this.refundsService.listForUser(userId, { status, page, pageSize });
  }

  // ==================== Seller Routes ====================

  /**
   * Seller: List all refunds (paginated, filterable)
   * GET /api/refunds
   */
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get('api/refunds')
  async listForSeller(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    const sellerId = req.user?.id;
    return this.refundsService.listForSeller(sellerId, { status, page, pageSize, keyword });
  }

  /**
   * Seller: Get refund detail
   * GET /api/refunds/:id
   */
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get('api/refunds/:id')
  async getRefundDetail(@Param('id') id: string) {
    return this.refundsService.getDetail(id);
  }

  /**
   * Seller: Approve a refund
   * POST /api/refunds/:id/approve
   */
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post('api/refunds/:id/approve')
  async approveRefund(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { reply?: string },
  ) {
    const sellerId = req.user?.id;
    return this.refundsService.approveRefund(id, sellerId, { reply: body.reply });
  }

  /**
   * Seller: Reject a refund
   * POST /api/refunds/:id/reject
   */
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post('api/refunds/:id/reject')
  async rejectRefund(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { reply: string },
  ) {
    const sellerId = req.user?.id;
    if (!body.reply?.trim()) {
      throw new BadRequestException('拒绝退款需要说明原因');
    }
    return this.refundsService.rejectRefund(id, sellerId, { reply: body.reply });
  }
}
