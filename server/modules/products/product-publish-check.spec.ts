import { describe, expect, it } from 'vitest';
import { evaluatePublishReadiness } from './product-publish-check';
import type { Product } from '../../../shared/api.interface';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    sellerId: 's1',
    titleZh: '商品',
    titleEn: 'Product',
    descZh: '',
    descEn: '',
    longDescZh: '',
    longDescEn: '',
    categoryId: 'c1',
    coverImage: 'https://example.com/a.png',
    images: [],
    bulletPointsZh: [],
    bulletPointsEn: [],
    optionNames: [],
    variants: [],
    minPrice: '9.90',
    totalStock: 5,
    totalSold: 0,
    status: 'draft',
    seoKeywordsZh: '',
    seoKeywordsEn: '',
    createdAt: '2026-10-22T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
    ...overrides,
  } as Product;
}

// 行为契约（R22）：上架门禁 fail-closed，任一必需项缺失即不可上架
describe('evaluatePublishReadiness', () => {
  it('R22: 完整商品可直接上架', () => {
    const result = evaluatePublishReadiness(product({ descZh: '描述' }));
    expect(result.ready).toBe(true);
    expect(result.blockingCount).toBe(0);
  });

  it('R22: 缺图 / 零价 / 零库存 / 无描述 / 无分类 分别阻断', () => {
    const noImage = evaluatePublishReadiness(product({ descZh: 'd', coverImage: undefined }));
    expect(noImage.ready).toBe(false);
    expect(noImage.checks.find((c) => c.key === 'image')?.ok).toBe(false);

    const zeroPrice = evaluatePublishReadiness(product({ descZh: 'd', minPrice: '0' }));
    expect(zeroPrice.checks.find((c) => c.key === 'price')?.ok).toBe(false);

    const zeroStock = evaluatePublishReadiness(product({ descZh: 'd', totalStock: 0 }));
    expect(zeroStock.checks.find((c) => c.key === 'stock')?.ok).toBe(false);

    const noDesc = evaluatePublishReadiness(product());
    expect(noDesc.checks.find((c) => c.key === 'description')?.ok).toBe(false);

    const noCategory = evaluatePublishReadiness(product({ descZh: 'd', categoryId: undefined }));
    expect(noCategory.checks.find((c) => c.key === 'category')?.ok).toBe(false);
  });

  it('R22: 英文标题缺失也阻断', () => {
    const result = evaluatePublishReadiness(product({ descZh: 'd', titleEn: '  ' }));
    expect(result.ready).toBe(false);
    expect(result.checks.find((c) => c.key === 'title')?.ok).toBe(false);
  });

  it('R22: 未通过项都带修复提示', () => {
    const result = evaluatePublishReadiness(product());
    for (const check of result.checks.filter((c) => !c.ok)) {
      expect(check.hint && check.hint.length > 0).toBe(true);
    }
  });

  it('R22: blockingCount 与失败项数量一致', () => {
    const result = evaluatePublishReadiness(product({ descZh: '', totalStock: 0 }));
    expect(result.blockingCount).toBe(result.checks.filter((c) => !c.ok).length);
  });
});
