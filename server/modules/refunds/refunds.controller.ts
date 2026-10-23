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
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';

import { RefundsService } from './refunds.service';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller()
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  /** RolesGuard 已校验卖家身份；此处集中收窄 userId 类型 */
  private getSellerId(req: Request): string {
    if (!req.user) {
      throw new ForbiddenException('请先登录');
    }
    return req.user.id;
  }

  // ==================== Buyer Routes ====================

  /**
   * Buyer: Apply for a refund on an order
   * POST /api/orders/:orderId/refunds
   */
  @Post('orders/:orderId/refunds')
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
  @Get('my/refunds')
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

  /**
   * Buyer: Get own refund detail
   * GET /api/my/refunds/:id
   */
  @Get('my/refunds/:id')
  async getMyRefund(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('请先登录');
    }
    return this.refundsService.getDetail(id, userId);
  }

  // ==================== Seller Routes ====================

  /**
   * Seller: List all refunds (paginated, filterable)
   * GET /api/refunds
   */
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get('refunds')
  async listForSeller(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    const sellerId = this.getSellerId(req);
    return this.refundsService.listForSeller(
      sellerId,
      { status, page, pageSize, keyword },
      req.user?.role,
    );
  }

  /**
   * Seller: Get refund detail
   * GET /api/refunds/:id
   */
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get('refunds/:id')
  async getRefundDetail(@Req() req: Request, @Param('id') id: string) {
    return this.refundsService.getDetail(id, undefined, {
      sellerId: this.getSellerId(req),
      role: req.user?.role,
    });
  }

  /**
   * Seller: Approve a refund
   * POST /api/refunds/:id/approve
   */
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post('refunds/:id/approve')
  async approveRefund(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { reply?: string },
  ) {
    const sellerId = this.getSellerId(req);
    return this.refundsService.approveRefund(id, sellerId, { reply: body.reply }, req.user?.role);
  }

  /**
   * Seller: Reject a refund
   * POST /api/refunds/:id/reject
   */
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post('refunds/:id/reject')
  async rejectRefund(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { reply: string },
  ) {
    const sellerId = this.getSellerId(req);
    if (!body.reply?.trim()) {
      throw new BadRequestException('拒绝退款需要说明原因');
    }
    return this.refundsService.rejectRefund(id, sellerId, { reply: body.reply }, req.user?.role);
  }
}
