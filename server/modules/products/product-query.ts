import { type SQL, sql } from 'drizzle-orm';
import { products } from '../../database/schema';

export interface PriceRange {
  minPrice?: number;
  maxPrice?: number;
}

/**
 * 价格过滤：只匹配「存在符合区间的在售规格」的商品。
 * 参数由 validatePriceRange 先行校验，这里仍用参数化 SQL（不拼字符串）。
 */
export function buildPriceRangeCondition(range: PriceRange): SQL | null {
  const { minPrice, maxPrice } = range;
  const hasMin = minPrice !== undefined;
  const hasMax = maxPrice !== undefined;
  if (!hasMin && !hasMax) return null;

  const minClause = hasMin ? sql`AND pv.price >= ${minPrice}` : sql``;
  const maxClause = hasMax ? sql`AND pv.price <= ${maxPrice}` : sql``;

  return sql`EXISTS (
    SELECT 1 FROM product_variants pv
    WHERE pv.product_id = ${products.id}
      AND pv.status = 'active'
      ${minClause}
      ${maxClause}
  )`;
}

/** 按最低在售价排序；无在售规格的商品排最后（NULLS LAST）。 */
export function priceOrderExpression(direction: 'asc' | 'desc'): SQL {
  const aggregate = sql`(
    SELECT MIN(pv.price) FROM product_variants pv
    WHERE pv.product_id = ${products.id} AND pv.status = 'active'
  )`;
  return direction === 'asc'
    ? sql`${aggregate} ASC NULLS LAST`
    : sql`${aggregate} DESC NULLS LAST`;
}

export type NormalizedSortBy = 'newest' | 'sold_desc' | 'price_asc' | 'price_desc';

/** 排序白名单：未知值一律回退到 newest，避免非法排序导致 SQL 报错。 */
export function normalizeSortBy(sortBy?: string): NormalizedSortBy {
  switch (sortBy) {
    case 'sold_desc':
    case 'price_asc':
    case 'price_desc':
      return sortBy;
    default:
      return 'newest';
  }
}

export type PriceRangeValidation =
  | { ok: true; range: PriceRange }
  | { ok: false; message: string };

/**
 * 价格区间参数校验（fail-closed）：
 * 负数、NaN、上下限倒挂一律拒绝，避免把非法值带进查询。
 */
export function validatePriceRange(range: PriceRange): PriceRangeValidation {
  const { minPrice, maxPrice } = range;
  if (minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) {
    return { ok: false, message: '最低价必须是非负数字' };
  }
  if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
    return { ok: false, message: '最高价必须是非负数字' };
  }
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    return { ok: false, message: '最低价不能高于最高价' };
  }
  return { ok: true, range: { minPrice, maxPrice } };
}
