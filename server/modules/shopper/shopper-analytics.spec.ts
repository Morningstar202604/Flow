import { describe, expect, it } from 'vitest';
import { ShopperAnalyticsService } from './shopper-analytics.service';
import type { Database } from '../../database/database.provider';

// 行为契约（R11）：漏斗按会话去重且逐级转化率计算正确；无数据时不除零
describe('ShopperAnalyticsService.getFunnel', () => {
  function serviceWithStages(
    stageRows: Array<{ stage: string; owners: number }>,
    keywordRows: Array<{ keyword: string | null; count: number }> = [],
    orderedOwners = 0,
  ): ShopperAnalyticsService {
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        const rows = call === 1 ? stageRows : call === 2 ? [{ owners: orderedOwners }] : keywordRows;
        const builder = {
          from: () => builder,
          where: () => builder,
          groupBy: () => builder,
          orderBy: () => builder,
          limit: async () => rows,
          then: (resolve: (value: unknown[]) => void) => resolve(rows),
        };
        return builder;
      },
    } as unknown as Database;
    return new ShopperAnalyticsService(db);
  }

  it('R11: 逐级转化率按上一阶段计算', async () => {
    const service = serviceWithStages([
      { stage: 'viewed', owners: 100 },
      { stage: 'recommended', owners: 50 },
      { stage: 'cart_confirmed', owners: 20 },
    ], [], 5);

    const funnel = await service.getFunnel(30);

    expect(funnel.stages.map((stage) => stage.sessions)).toEqual([100, 50, 20, 5]);
    expect(funnel.stages[1].conversionFromPrevious).toBe(0.5);
    expect(funnel.stages[2].conversionFromPrevious).toBe(0.4);
    expect(funnel.stages[3].conversionFromPrevious).toBe(0.25);
    expect(funnel.overallConversion).toBe(0.05);
  });

  it('R11: 无数据时全部为 0，不抛错不除零', async () => {
    const service = serviceWithStages([]);
    const funnel = await service.getFunnel(30);

    expect(funnel.stages.map((stage) => stage.sessions)).toEqual([0, 0, 0, 0]);
    expect(funnel.overallConversion).toBe(0);
    expect(funnel.topQueries).toEqual([]);
  });

  it('R11: 热词过滤空关键词并保留计数', async () => {
    const service = serviceWithStages(
      [{ stage: 'viewed', owners: 3 }],
      [{ keyword: '耳机', count: 7 }, { keyword: null, count: 2 }, { keyword: '', count: 1 }],
    );
    const funnel = await service.getFunnel(30);
    expect(funnel.topQueries).toEqual([{ keyword: '耳机', count: 7 }]);
  });

  it('R11: days 参数被裁剪到 1-365', async () => {
    const service = serviceWithStages([]);
    expect((await service.getFunnel(9999)).days).toBe(365);
    expect((await service.getFunnel(0)).days).toBe(1);
  });
});
