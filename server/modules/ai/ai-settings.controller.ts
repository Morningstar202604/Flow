import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { RolesGuard } from '../../common/guards/roles.guard';
import { AiSettingsService, type AiSettingsTestResult, type AiSettingsView } from './ai-settings.service';
import {
  CustomAgentsService,
  type AgentListResult,
  type CustomAgentView,
  type RunAgentResult,
} from './custom-agents.service';
import { CreateAgentDto, RunAgentDto, UpdateAgentDto, UpdateAiSettingsDto } from './dto/ai-settings.dto';

/**
 * 模型设置与自定义 Agent 管理（卖家/管理员）。
 * 模型配置优先级：UI 设置（此处保存）> 环境变量；未配置时所有 AI 端点诚实提示"请填写模型"。
 */
@Controller('ai')
@UseGuards(new RolesGuard(['seller', 'admin']))
export class AiSettingsController {
  constructor(
    private readonly settingsService: AiSettingsService,
    private readonly customAgentsService: CustomAgentsService,
  ) {}

  private getActorId(req: Request): string {
    return (req.user as { id: string }).id;
  }

  @Get('settings')
  async getSettings(): Promise<AiSettingsView> {
    return this.settingsService.get();
  }

  @Put('settings')
  async updateSettings(
    @Req() req: Request,
    @Body() dto: UpdateAiSettingsDto,
  ): Promise<AiSettingsView> {
    return this.settingsService.update(dto, this.getActorId(req));
  }

  @Post('settings/test')
  async testSettings(): Promise<AiSettingsTestResult> {
    return this.settingsService.test();
  }

  @Get('agents')
  async listAgents(): Promise<AgentListResult> {
    return this.customAgentsService.list();
  }

  @Post('agents')
  async createAgent(
    @Req() req: Request,
    @Body() dto: CreateAgentDto,
  ): Promise<CustomAgentView> {
    return this.customAgentsService.create(dto, this.getActorId(req));
  }

  @Put('agents/:id')
  async updateAgent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<CustomAgentView> {
    return this.customAgentsService.update(id, dto, this.getActorId(req));
  }

  @Delete('agents/:id')
  async removeAgent(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.customAgentsService.remove(id, this.getActorId(req));
  }

  @Post('agents/:id/run')
  async runAgent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RunAgentDto,
  ): Promise<RunAgentResult> {
    return this.customAgentsService.run(id, dto, this.getActorId(req));
  }
}
