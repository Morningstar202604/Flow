import { describe, expect, it } from 'vitest';
import { evaluateCopyQuality } from './copy-quality';
import type { Product } from '../../../shared/api.interface';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    sellerId: 's1',
    titleZh: '商品',
    titleEn: 'Premium Wireless Bluetooth Earbuds with ANC',
    descZh: '',
    descEn: '',
    longDescZh: '',
    longDescEn: 'A detailed description of the product that exceeds eighty characters in order to satisfy the minimum length requirement for quality checks.',
    categoryId: 'c1',
    coverImage: 'https://example.com/a.png',
    images: [],
    bulletPointsZh: [],
    bulletPointsEn: ['Active noise cancellation', 'Long battery life', 'Comfortable fit'],
    optionNames: [],
    variants: [],
    minPrice: '9.90',
    totalStock: 5,
    totalSold: 0,
    status: 'draft',
    seoKeywordsZh: '',
    seoKeywordsEn: 'earbuds, anc',
    createdAt: '2026-10-22T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
    ...overrides,
  } as Product;
}

// 行为契约（R29）：AI 文案质量启发式 - 合格不给假警报，劣质一定报
describe('evaluateCopyQuality', () => {
  it('R29: 完整高质量文案判定为合格', () => {
    const report = evaluateCopyQuality(product());
    expect(report.needsReview).toBe(false);
    expect(report.score).toBe(100);
    expect(report.issues).toEqual([]);
  });

  it('R29: 标题过短 / 缺标题被识别', () => {
    expect(evaluateCopyQuality(product({ titleEn: 'Earbuds' })).issues.map((i) => i.key)).toContain('title_short');
    expect(evaluateCopyQuality(product({ titleEn: '' })).issues.map((i) => i.key)).toContain('title_missing');
  });

  it('R29: 占位词与空泛套话被识别', () => {
    const lazy = evaluateCopyQuality(product({ titleEn: 'Lorem ipsum dolor sit amet consectetur' }));
    expect(lazy.issues.map((i) => i.key)).toContain('title_lazy');

    const generic = evaluateCopyQuality(
      product({
        longDescEn: 'This is a very good product with high quality and it is the best product you can buy anywhere today.',
      }),
    );
    expect(generic.issues.map((i) => i.key)).toContain('desc_lazy');
  });

  it('R29: 卖点不足 / 卖点过短被识别', () => {
    const few = evaluateCopyQuality(product({ bulletPointsEn: ['Good', 'Nice'] }));
    expect(few.issues.map((i) => i.key)).toContain('bullets_few');
    expect(few.issues.map((i) => i.key)).toContain('bullets_empty');
  });

  it('R29: SEO 关键词不足被识别', () => {
    const report = evaluateCopyQuality(product({ seoKeywordsEn: 'earbuds' }));
    expect(report.issues.map((i) => i.key)).toContain('seo_few');
  });

  it('R29: 英文标题混入中文被识别', () => {
    const report = evaluateCopyQuality(product({ titleEn: 'Premium 无线耳机 with ANC technology' }));
    expect(report.issues.map((i) => i.key)).toContain('title_not_en');
  });

  it('R29: 每多一个问题分数降 15，最低 0', () => {
    const bad = evaluateCopyQuality(
      product({ titleEn: '', bulletPointsEn: [], longDescEn: '', seoKeywordsEn: '' }),
    );
    expect(bad.score).toBe(Math.max(0, 100 - bad.issues.length * 15));
    expect(bad.needsReview).toBe(true);
  });
});
