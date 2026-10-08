import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { eq, and, gte, lte, count, sum } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { aiUsageLog } from '@server/database/schema';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ChatResult {
  content: string;
  usage?: ChatUsage;
}

interface UsageStats {
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

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    private readonly httpService: HttpService,
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
  ) {
    this.baseUrl = process.env.LLM_BASE_URL || '';
    this.apiKey = process.env.LLM_API_KEY || '';
    this.model = process.env.LLM_MODEL || 'deepseek-chat';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  getModel(): string {
    return this.model;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('未配置 LLM API Key');
    }
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions & { agent?: string; userId?: string },
  ): Promise<ChatResult> {
    const agent = options?.agent ?? 'unknown';
    const userId = options?.userId;
    const startMs = Date.now();

    if (!this.isConfigured()) {
      await this.logUsage({
        agent,
        success: false,
        durationMs: 0,
        errorMessage: '未配置 LLM API Key',
        userId,
      });
      throw new BadRequestException('未配置 LLM API Key');
    }

    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens ?? 2000;
    const responseFormat = options?.responseFormat === 'json'
      ? { type: 'json_object' as const }
      : undefined;

    const body = {
      model: this.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    };

    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }),
      );

      const choices = response.data?.choices;
      if (!choices || choices.length === 0) {
        throw new InternalServerErrorException('LLM 返回为空');
      }
      const content: string = choices[0]?.message?.content ?? '';
      if (!content) {
        throw new InternalServerErrorException('LLM 返回内容为空');
      }

      const usageRaw = response.data?.usage;
      const usage: ChatUsage | undefined = usageRaw
        ? {
            prompt_tokens: usageRaw.prompt_tokens ?? 0,
            completion_tokens: usageRaw.completion_tokens ?? 0,
            total_tokens: usageRaw.total_tokens ?? 0,
          }
        : undefined;

      const durationMs = Date.now() - startMs;
      void this.logUsage({
        agent,
        success: true,
        durationMs,
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        userId,
      });

      return { content, usage };
    } catch (error: unknown) {
      const durationMs = Date.now() - startMs;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('LLM 调用失败', error instanceof Error ? error.stack : String(error));

      void this.logUsage({
        agent,
        success: false,
        durationMs,
        errorMessage,
        userId,
      });

      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('AI 服务调用失败，请稍后重试');
    }
  }

  private async logUsage(params: {
    agent: string;
    success: boolean;
    durationMs: number;
    inputTokens?: number;
    outputTokens?: number;
    errorMessage?: string;
    userId?: string;
  }): Promise<void> {
    try {
      await this.db.insert(aiUsageLog).values({
        agent: params.agent,
        model: this.model,
        inputTokens: params.inputTokens ?? 0,
        outputTokens: params.outputTokens ?? 0,
        durationMs: params.durationMs,
        success: params.success,
        errorMessage: params.errorMessage,
        userId: params.userId,
      });
    } catch (err: unknown) {
      this.logger.error('写入 AI 计量日志失败', err instanceof Error ? err.stack : String(err));
    }
  }

  async getUsageStats(params?: {
    agent?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<UsageStats> {
    const conditions = [];
    if (params?.agent) {
      conditions.push(eq(aiUsageLog.agent, params.agent));
    }
    if (params?.startDate) {
      conditions.push(gte(aiUsageLog.createdAt, new Date(params.startDate)));
    }
    if (params?.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(aiUsageLog.createdAt, end));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const aggregateRows = await this.db
      .select({
        totalCalls: count(aiUsageLog.id),
        totalInputTokens: sum(aiUsageLog.inputTokens).mapWith(Number),
        totalOutputTokens: sum(aiUsageLog.outputTokens).mapWith(Number),
        totalDurationMs: sum(aiUsageLog.durationMs).mapWith(Number),
      })
      .from(aiUsageLog)
      .where(whereClause);

    const successCountRows = await this.db
      .select({ count: count(aiUsageLog.id) })
      .from(aiUsageLog)
      .where(
        whereClause
          ? and(whereClause, eq(aiUsageLog.success, true))
          : eq(aiUsageLog.success, true),
      );

    const byAgentRows = await this.db
      .select({
        agent: aiUsageLog.agent,
        calls: count(aiUsageLog.id),
        inputTokens: sum(aiUsageLog.inputTokens).mapWith(Number),
        outputTokens: sum(aiUsageLog.outputTokens).mapWith(Number),
        durationMs: sum(aiUsageLog.durationMs).mapWith(Number),
      })
      .from(aiUsageLog)
      .where(whereClause)
      .groupBy(aiUsageLog.agent)
      .orderBy(aiUsageLog.agent);

    const agg = aggregateRows[0];
    const totalCalls = Number(agg?.totalCalls ?? 0);
    const successCount = Number(successCountRows[0]?.count ?? 0);
    const successRate = totalCalls > 0 ? successCount / totalCalls : 0;

    return {
      totalCalls,
      totalInputTokens: agg?.totalInputTokens ?? 0,
      totalOutputTokens: agg?.totalOutputTokens ?? 0,
      totalDurationMs: agg?.totalDurationMs ?? 0,
      successRate,
      byAgent: byAgentRows.map((row) => ({
        agent: row.agent,
        calls: Number(row.calls),
        inputTokens: row.inputTokens ?? 0,
        outputTokens: row.outputTokens ?? 0,
        durationMs: row.durationMs ?? 0,
      })),
    };
  }
}
