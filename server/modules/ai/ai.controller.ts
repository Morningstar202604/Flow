import { Controller, Post, Get, Body, Req, Query, UseGuards, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { RolesGuard } from '@server/common/guards/roles.guard';
import { AiGatewayService } from './ai-gateway.service';
import { CopywriterService } from './copywriter.service';
import { SupportService } from './support.service';
import { TrendService } from './trend.service';
import { SelectService } from './select.service';
import { TranslationService } from './translation.service';
import type {
  AICopywriterRequest,
  AICopywriterResponse,
  AITranslationRequest,
  AITranslationResponse,
  AITrendReport,
  AISelectResponse,
  AIStatusResponse,
  SupportChatRequest,
  SupportChatResponse,
} from '@shared/api.interface';

interface UsageStatsResponse {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
  successRate: number;
  byAgent: Array<{
    agent: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  }>;
}

@Controller('api/ai')
export class AiController {
  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly copywriterService: CopywriterService,
    private readonly supportService: SupportService,
    private readonly trendService: TrendService,
    private readonly selectService: SelectService,
    private readonly translationService: TranslationService,
  ) {}

  @Get('status')
  getStatus(): AIStatusResponse {
    return {
      configured: this.aiGateway.isConfigured(),
      model: this.aiGateway.isConfigured() ? this.aiGateway.getModel() : undefined,
    };
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get('usage-stats')
  async getUsageStats(
    @Query('agent') agent?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<UsageStatsResponse> {
    return this.aiGateway.getUsageStats({ agent, startDate, endDate });
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post('copywriter')
  async copywriter(
    @Body() dto: AICopywriterRequest,
    @Req() req: Request,
  ): Promise<AICopywriterResponse> {
    const userId = req.user?.id;
    return this.copywriterService.generate(dto, userId);
  }

  @Post('support/chat')
  async supportChat(
    @Body() dto: SupportChatRequest,
    @Req() req: Request,
  ): Promise<SupportChatResponse> {
    const userId = req.user?.id;
    return this.supportService.chat(dto, userId);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post('trend/generate')
  async generateTrend(@Req() req: Request): Promise<AITrendReport> {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('用户未登录');
    return this.trendService.generateTrendReport(userId);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post('select/generate')
  async generateSelect(@Req() req: Request): Promise<AISelectResponse> {
    const userId = req.user?.id;
    return this.selectService.selectProducts(userId);
  }

  @Post('translate')
  async translate(
    @Body() dto: AITranslationRequest,
    @Req() req: Request,
  ): Promise<AITranslationResponse> {
    const userId = req.user?.id;
    return this.translationService.translate(dto, userId);
  }
}
