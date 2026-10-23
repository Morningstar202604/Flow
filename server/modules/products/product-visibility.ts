import type { ProductListParams } from '../../../shared/api.interface';

export type ProductStatus = 'draft' | 'active' | 'inactive';

interface Scope {
  sellerId?: string;
  role?: string;
}

export interface ProductQueryPlan {
  /** 是否应用卖家本人过滤 */
  mine: boolean;
  sellerId?: string;
  /** 需要过滤的状态；undefined 表示不限状态 */
  status?: ProductStatus | string;
}

/**
 * 商品列表可见性决策（fail-closed）：
 * - 公开/买家：永远只能看到 active，忽略 status 参数（防止 ?status=draft 泄露草稿）
 * - 卖家 + scope=mine：只看自己店铺，默认全部状态，可显式筛选
 */
export function planProductQuery(params: ProductListParams, scope?: Scope): ProductQueryPlan {
  const isSeller = scope?.role === 'seller' || scope?.role === 'admin';
  const mine = params.scope === 'mine' && isSeller && Boolean(scope?.sellerId);
  if (mine) {
    return {
      mine: true,
      sellerId: scope?.sellerId,
      status: params.status,
    };
  }
  return { mine: false, status: 'active' };
}
