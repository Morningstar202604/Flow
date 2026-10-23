import { describe, expect, it } from 'vitest';
import { normalizeSortBy, validatePriceRange } from './product-query';

describe('product-query', () => {
  it('价格区间：合法值通过', () => {
    expect(validatePriceRange({ minPrice: 10, maxPrice: 20 }).ok).toBe(true);
    expect(validatePriceRange({ minPrice: 0 }).ok).toBe(true);
  });

  it('价格区间：负数 / NaN / 倒挂被拒绝', () => {
    expect(validatePriceRange({ minPrice: -1 }).ok).toBe(false);
    expect(validatePriceRange({ maxPrice: Number.NaN }).ok).toBe(false);
    expect(validatePriceRange({ minPrice: 30, maxPrice: 20 }).ok).toBe(false);
  });

  it('排序：白名单之外回退 newest', () => {
    expect(normalizeSortBy('price_asc')).toBe('price_asc');
    expect(normalizeSortBy('price_desc')).toBe('price_desc');
    expect(normalizeSortBy('drop table')).toBe('newest');
    expect(normalizeSortBy(undefined)).toBe('newest');
  });
});
