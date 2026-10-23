import { describe, expect, it } from 'vitest';
import { planProductQuery } from './product-visibility';

describe('product-visibility', () => {
  it('R4: 卖家 scope=mine 默认看到全部状态', () => {
    const plan = planProductQuery({ scope: 'mine' }, { sellerId: 's1', role: 'seller' });
    expect(plan.mine).toBe(true);
    expect(plan.sellerId).toBe('s1');
    expect(plan.status).toBeUndefined();
  });

  it('R4: 卖家 scope=mine 可按状态筛选', () => {
    const plan = planProductQuery({ scope: 'mine', status: 'draft' }, { sellerId: 's1', role: 'seller' });
    expect(plan.status).toBe('draft');
  });

  it('R4: 买家/匿名伪造 scope=mine 无效，仅返回 active', () => {
    expect(planProductQuery({ scope: 'mine' }, { sellerId: 'u1', role: 'buyer' }).mine).toBe(false);
    expect(planProductQuery({ scope: 'mine' }).mine).toBe(false);
    expect(planProductQuery({ scope: 'mine' }).status).toBe('active');
  });

  it('R4: 公开请求不能通过 status=draft 读取草稿', () => {
    expect(planProductQuery({ status: 'draft' }).status).toBe('active');
    expect(planProductQuery({ status: 'inactive' }, { role: 'buyer' }).status).toBe('active');
  });

  it('R4: 管理员 scope=mine 也可查自己名下商品', () => {
    expect(planProductQuery({ scope: 'mine' }, { sellerId: 'admin-1', role: 'admin' }).mine).toBe(true);
  });
});
