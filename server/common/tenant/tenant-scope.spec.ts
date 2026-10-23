import { describe, expect, it } from 'vitest';
import {
  canAccessSellerResource,
  isPlatformAdmin,
  resolveSingleSellerId,
} from './tenant-scope';

describe('tenant-scope', () => {
  it('R1: 卖家只能访问自己名下的资源', () => {
    expect(canAccessSellerResource('seller-a', 'seller-a', 'seller')).toBe(true);
    expect(canAccessSellerResource('seller-b', 'seller-a', 'seller')).toBe(false);
  });

  it('R1: 管理员可跨租户访问', () => {
    expect(isPlatformAdmin('admin')).toBe(true);
    expect(canAccessSellerResource('seller-b', 'admin-1', 'admin')).toBe(true);
  });

  it('R1: 无归属的历史资源仅管理员可访问（fail-closed）', () => {
    expect(canAccessSellerResource(null, 'seller-a', 'seller')).toBe(false);
    expect(canAccessSellerResource(undefined, 'seller-a', 'seller')).toBe(false);
    expect(canAccessSellerResource(null, 'admin-1', 'admin')).toBe(true);
  });

  it('R1: 匿名访问一律拒绝', () => {
    expect(canAccessSellerResource('seller-a', undefined, undefined)).toBe(false);
  });

  it('R1: 跨卖家商品不能合单', () => {
    expect(resolveSingleSellerId(['a', 'a']).sellerId).toBe('a');
    expect(resolveSingleSellerId(['a', 'b']).crossSeller).toBe(true);
    expect(resolveSingleSellerId([]).sellerId).toBeNull();
  });
});
