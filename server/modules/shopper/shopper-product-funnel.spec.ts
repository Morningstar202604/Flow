import { describe, expect, it } from 'vitest';
import { ShopperAnalyticsService } from './shopper-analytics.service';
import type { Database } from '../../database/database.provider';

// 行为契约（R16）：商品级漏斗按会话去重，转化率=加购/推荐，按推荐量降序
describe('ShopperAnalyticsService.getProductFunnel', () => {
  function service(fixtures: {
    stageRows: Array<{ productId: string | null; stage: string; sessions: number }>;
    products?: Array<{ id: string; titleZh: string; titleEn: string; totalStock: number; avgRating: string }>;
    prices?: Array<{ productId: string; minPrice: string }>;
    ordered?: Array<{ product_id: string; sessions: number }>;
  }): ShopperAnalyticsService {
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        const rows = call === 1
          ? fixtures.stageRows
          : call === 2
            ? (fixtures.products ?? [])
            : (fixtures.prices ?? []);
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
      execute: async () => fixtures.ordered ?? [],
    } as unknown as Database;
    return new ShopperAnalyticsService(db);
  }

  it('R16: 转化率按商品计算并按推荐量排序', async () => {
    const analytics = service({
      stageRows: [
        { productId: 'p1', stage: 'product_recommended', sessions: 10 },
        { productId: 'p1', stage: 'cart_confirmed', sessions: 2 },
        { productId: 'p2', stage: 'product_recommended', sessions: 4 },
        { productId: 'p2', stage: 'cart_confirmed', sessions: 2 },
      ],
      products: [
        { id: 'p1', titleZh: '商品一', titleEn: 'P1', totalStock: 5, avgRating: '4.50' },
        { id: 'p2', titleZh: '商品二', titleEn: 'P2', totalStock: 9, avgRating: '0' },
      ],
      prices: [
        { productId: 'p1', minPrice: '19.90' },
        { productId: 'p2', minPrice: '9.90' },
      ],
      ordered: [{ product_id: 'p1', sessions: 1 }],
    });

    const result = await analytics.getProductFunnel(30, 20);

    expect(result.items.map((item) => item.productId)).toEqual(['p1', 'p2']);
    expect(result.items[0].cartRate).toBe(0.2);
    expect(result.items[0].orderedSessions).toBe(1);
    expect(result.items[1].cartRate).toBe(0.5);
  });

  it('R16: 没有任何商品事件时返回空列表', async () => {
    const analytics = service({ stageRows: [] });
    expect((await analytics.getProductFunnel()).items).toEqual([]);
  });

  it('R16: 推荐 0 次时不除零', async () => {
    const analytics = service({
      stageRows: [{ productId: 'p1', stage: 'cart_confirmed', sessions: 3 }],
      products: [{ id: 'p1', titleZh: '商品一', titleEn: 'P1', totalStock: 1, avgRating: '0' }],
      prices: [],
    });
    const result = await analytics.getProductFunnel();
    expect(result.items[0].recommendedSessions).toBe(0);
    expect(result.items[0].cartRate).toBe(0);
  });
});
