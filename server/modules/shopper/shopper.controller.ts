import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { Throttle } from '@nestjs/throttler';

import { RolesGuard } from '../../common/guards/roles.guard';
import { ShopperService, type ShopperContext } from './shopper.service';
import type {
  CopilotActionResolveResult,
  CopilotConversation,
  CopilotConversationDetail,
  CopilotSendResult,
  CopilotToolsView,
} from '../../../shared/api.interface';

export class ShopperSendDto {
  @IsString()
  @Length(1, 1000, { message: '消息长度需为 1-1000 字符' })
  content!: string;
}

export class ShopperResolveDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  reason?: string;
}

/**
 * 买家端 AI 导购（登录买家或匿名会话均可）。
 * 与卖家副驾工具集完全隔离：这里只有搜索/详情/购物车/加购。
 * 匿名会话通过 x-session-id 头识别（与购物车一致）。
 */
@Controller('shopper')
export class ShopperController {
  constructor(private readonly shopperService: ShopperService) {}

  private getContext(req: Request): ShopperContext {
    const raw = req.headers['x-session-id'];
    const headerSession = Array.isArray(raw) ? raw[0] : raw;
    const sessionId = typeof headerSession === 'string' && headerSession.trim().length > 0
      ? headerSession.trim()
      : undefined;

    const user = req.user;
    if (user && user.role !== 'buyer') {
      // 卖家/管理员账号也可浏览商城，此时按登录用户归属
      return { userId: user.id };
    }
    return { userId: user?.id, sessionId };
  }

  @Get('tools')
  async getTools(): Promise<CopilotToolsView> {
    return this.shopperService.getTools();
  }

  @Get('conversations')
  async listConversations(@Req() req: Request): Promise<CopilotConversation[]> {
    return this.shopperService.listConversations(this.getContext(req));
  }

  @Post('conversations')
  async createConversation(@Req() req: Request): Promise<CopilotConversation> {
    return this.shopperService.createConversation(this.getContext(req));
  }

  @Get('conversations/:id')
  async getConversation(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<CopilotConversationDetail> {
    return this.shopperService.getConversationDetail(this.getContext(req), id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ShopperSendDto,
  ): Promise<CopilotSendResult> {
    return this.shopperService.sendMessage(this.getContext(req), id, dto.content);
  }

  @Post('actions/:id/resolve')
  async resolveAction(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ShopperResolveDto,
  ): Promise<CopilotActionResolveResult> {
    return this.shopperService.resolveAction(this.getContext(req), id, dto.approve);
  }
}
