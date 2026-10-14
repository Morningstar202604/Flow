import { BadRequestException, Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { visits } from '../../database/schema';

const SESSION_ID_PATTERN = /^[\w-]{8,64}$/;

/**
 * 匿名访问埋点（买家商城在会话内首次打开时上报一次）。
 * 用于卖家看板的真实访客数（按浏览器会话去重）。
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('visit')
  async recordVisit(
    @Req() req: Request,
    @Body() body: { sessionId?: string; path?: string },
  ): Promise<{ ok: boolean }> {
    const sessionId = body.sessionId?.trim() ?? '';
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      throw new BadRequestException('sessionId 非法');
    }
    const path = (body.path ?? '/').split('?')[0].slice(0, 200) || '/';

    await this.db.insert(visits).values({
      sessionId,
      path,
      userId: req.user?.id ?? null,
    });

    return { ok: true };
  }
}
