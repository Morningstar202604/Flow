import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, gte, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { orders, shopperEvents } from '../../database/schema';
import type {
  ShopperFunnelResponse,
  ShopperFunnelStage,
  ShopperTopQuery,
} from '../../../shared/api.interface';

export type ShopperStage = 'viewed' | 'recommended' | 'cart_confirmed' | 'ordered';

/**
 * 导购转化漏斗：只做"阶段打点 + 去重计数"，不采集搜索词以外的个人信息。
 * 去重口径 = 会话（登录用 userId，匿名用 sessionId），避免同一人多轮对话重复计数。
 */
@Injectable()
export class ShopperAnalyticsService {
  private readonly logger = new Logger(ShopperAnalyticsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  /** 打点：失败只记日志，绝不影响导购主流程 */
  async track(params: {
    userId?: string | null;
    sessionId?: string | null;
    stage: ShopperStage;
    conversationId?: string | null;
    productId?: string | null;
    keyword?: string | null;
  }): Promise<void> {
    try {
      if (!params.userId && !params.sessionId) return;
      await this.db.insert(shopperEvents).values({
        userId: params.userId ?? null,
        sessionId: params.userId ? null : (params.sessionId ?? null),
        stage: params.stage,
        conversationId: params.conversationId ?? null,
        productId: params.productId ?? null,
        keyword: params.keyword?.slice(0, 100) ?? null,
      });
    } catch (error: unknown) {
      this.logger.warn(
        `导购埋点写入失败（${params.stage}）：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** 漏斗统计（近 N 天），返回各阶段去重会话数、转化率与热词 */
  async getFunnel(days = 30): Promise<ShopperFunnelResponse> {
    const safeDays = Math.max(1, Math.min(365, Math.round(days)));
    const since = new Date(Date.now() - safeDays * 24 * 3600 * 1000);
    const ownerExpr = sql<string>`COALESCE(${shopperEvents.userId}::text, ${shopperEvents.sessionId})`;

    const rows = await this.db
      .select({
        stage: shopperEvents.stage,
        owners: sql<number>`COUNT(DISTINCT ${ownerExpr})::int`,
      })
      .from(shopperEvents)
      .where(gte(shopperEvents.createdAt, since))
      .groupBy(shopperEvents.stage);

    const byStage = new Map(rows.map((row) => [row.stage, Number(row.owners)]));
    const viewed = byStage.get('viewed') ?? 0;
    const recommended = byStage.get('recommended') ?? 0;
    const cartConfirmed = byStage.get('cart_confirmed') ?? 0;

    // 下单阶段不用打点推断，直接联真实订单：
    // 登录买家按 userId 匹配；匿名按 addressSnapshot.sessionId 匹配（与游客订单归属同一口径）。
    const orderedRows = await this.db
      .select({
        owners: sql<number>`COUNT(DISTINCT COALESCE(${orders.userId}::text, ${orders.addressSnapshot}::jsonb ->> 'sessionId'))::int`,
      })
      .from(orders)
      .where(and(
        gte(orders.createdAt, since),
        sql`COALESCE(${orders.userId}::text, ${orders.addressSnapshot}::jsonb ->> 'sessionId') IN (
          SELECT COALESCE(${shopperEvents.userId}::text, ${shopperEvents.sessionId})
          FROM ${shopperEvents}
          WHERE ${shopperEvents.stage} = 'cart_confirmed' AND ${shopperEvents.createdAt} >= ${since.toISOString()}
        )`,
      ));
    const ordered = Number(orderedRows[0]?.owners ?? 0);

    const stages: ShopperFunnelStage[] = [
      { stage: 'viewed', label: '打开导购', sessions: viewed, conversionFromPrevious: viewed > 0 ? 1 : 0 },
      { stage: 'recommended', label: '获得推荐', sessions: recommended, conversionFromPrevious: ratio(recommended, viewed) },
      { stage: 'cart_confirmed', label: '确认加购', sessions: cartConfirmed, conversionFromPrevious: ratio(cartConfirmed, recommended) },
      { stage: 'ordered', label: '完成下单', sessions: ordered, conversionFromPrevious: ratio(ordered, cartConfirmed) },
    ];

    const topQueryRows = await this.db
      .select({
        keyword: shopperEvents.keyword,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(shopperEvents)
      .where(and(
        gte(shopperEvents.createdAt, since),
        sql`${shopperEvents.keyword} IS NOT NULL`,
        sql`${shopperEvents.keyword} <> ''`,
      ))
      .groupBy(shopperEvents.keyword)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    const topQueries: ShopperTopQuery[] = topQueryRows
      .filter((row) => !!row.keyword)
      .map((row) => ({ keyword: row.keyword as string, count: Number(row.count) }));

    return {
      since: since.toISOString(),
      days: safeDays,
      stages,
      overallConversion: ratio(ordered, viewed),
      topQueries,
    };
  }
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}
