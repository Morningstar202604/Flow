import { describe, expect, it } from 'vitest';
import { computeCouponDiscount } from './coupon-discount';

// 行为契约（R8）：折扣口径唯一化 —— percent 四舍五入到分、fixed 原值、不超订单金额
describe('computeCouponDiscount', () => {
  it('R8: percent 按比例计算并四舍五入到分', () => {
    expect(computeCouponDiscount('percent', '10', '99.90').toFixed(2)).toBe('9.99');
    expect(computeCouponDiscount('percent', '15', '88.88').toFixed(2)).toBe('13.33');
    expect(computeCouponDiscount('percent', '100', '50.00').toFixed(2)).toBe('50.00');
  });

  it('R8: fixed 原值、封顶不超订单金额', () => {
    expect(computeCouponDiscount('fixed', '10', '50.00').toFixed(2)).toBe('10.00');
    expect(computeCouponDiscount('fixed', '10', '5.00').toFixed(2)).toBe('5.00');
    expect(computeCouponDiscount('fixed', '999', '1.00').toFixed(2)).toBe('1.00');
  });

  it('R8: free_shipping 折扣恒为 0', () => {
    expect(computeCouponDiscount('free_shipping', '100', '80.00').toFixed(2)).toBe('0.00');
  });

  it('R8: 浮点输入不产生误差（0.1+0.2 场景）', () => {
    expect(computeCouponDiscount('percent', '10', 0.3).toFixed(2)).toBe('0.03');
    expect(computeCouponDiscount('fixed', '0.3', 0.1).toFixed(2)).toBe('0.10');
  });
});
