export type ActorRole = 'buyer' | 'seller' | 'admin' | string | undefined;

/** 平台管理员可跨租户操作，其余角色只能访问自己名下的资源。 */
export function isPlatformAdmin(role?: string): boolean {
  return role === 'admin';
}

/**
 * 卖家资源归属判定（fail-closed）：
 * - 无操作者身份 → 拒绝
 * - 资源无归属（历史数据 sellerId 为 NULL）→ 仅管理员可访问
 * - 归属与操作者不一致 → 拒绝
 */
export function canAccessSellerResource(
  resourceSellerId: string | null | undefined,
  actorId: string | undefined,
  role?: string,
): boolean {
  if (!actorId) return false;
  if (isPlatformAdmin(role)) return true;
  return Boolean(resourceSellerId) && resourceSellerId === actorId;
}

/** 从商品行集合推导订单归属；跨卖家订单不允许合单。 */
export function resolveSingleSellerId(
  sellerIds: Array<string | null | undefined>,
): { sellerId: string | null; crossSeller: boolean } {
  const unique = [...new Set(sellerIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return { sellerId: null, crossSeller: false };
  if (unique.length > 1) return { sellerId: null, crossSeller: true };
  return { sellerId: unique[0], crossSeller: false };
}
