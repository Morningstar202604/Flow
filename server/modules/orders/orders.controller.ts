import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { OrdersService } from './orders.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveClientIp } from '../../common/http/client-ip';
import type {
  Order,
  OrderListResponse,
  OrderStatus,
  CreateOrderRequest,
  OrderStatusUpdateRequest,
} from '../../../shared/api.interface';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private getSessionId(req: Request): string | undefined {
    const raw = req.headers['x-session-id'];
    const sessionId = Array.isArray(raw) ? raw[0] : raw;
    if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
      return sessionId.trim();
    }
    return undefined;
  }

  private getClientIp(req: Request): string {
    return resolveClientIp(req);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get()
  async getOrderList(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: OrderStatus,
    @Query('keyword') keyword?: string,
  ): Promise<OrderListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    const safePage = Math.max(1, pageNum);
    const safePageSize = Math.min(50, Math.max(1, pageSizeNum));

    return this.ordersService.getOrderList(safePage, safePageSize, status, keyword, {
      actorId: req.user?.id,
      role: req.user?.role,
    });
  }

  @Get('buyer')
  async getBuyerOrders(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<OrderListResponse> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req);
    if (!userId && !sessionId) {
      return { items: [], total: 0, page: 1, pageSize: 10 };
    }
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    const safePage = Math.max(1, pageNum);
    const safePageSize = Math.min(50, Math.max(1, pageSizeNum));

    return this.ordersService.getBuyerOrders(userId, sessionId, safePage, safePageSize);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get('seller/:id')
  async getSellerOrderDetail(@Req() req: Request, @Param('id') id: string): Promise<Order> {
    return this.ordersService.getSellerOrderDetail(id, req.user?.id, req.user?.role);
  }

  @Get(':id')
  async getOrderDetail(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<Order> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req);
    const isSeller = !!req.user && ['seller', 'admin'].includes(req.user.role);
    return this.ordersService.getOrderDetail(id, userId, sessionId, isSeller);
  }

  @Post()
  async createOrder(@Req() req: Request, @Body() dto: CreateOrderRequest): Promise<Order> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req);
    const ip = this.getClientIp(req);
    return this.ordersService.createOrder(dto, userId, sessionId, { ip });
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Patch(':id/status')
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: OrderStatusUpdateRequest,
  ): Promise<Order> {
    const userId = req.user?.id;
    const role = req.user?.role;
    const ip = this.getClientIp(req);
    return this.ordersService.updateStatus(id, dto, userId, role, ip);
  }

  @Post(':id/cancel')
  async cancelOrder(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<Order> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req);
    const ip = this.getClientIp(req);
    await this.ordersService.getOrderDetail(id, userId, sessionId);
    return this.ordersService.updateStatus(
      id,
      { status: 'cancelled' },
      userId,
      userId ? req.user?.role : undefined,
      ip,
    );
  }
}
