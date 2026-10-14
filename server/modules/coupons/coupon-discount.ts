import { Decimal } from 'decimal.js';

export type CouponDiscountType = 'percent' | 'fixed' | 'free_shipping';

/**
 * 优惠券折扣计算唯一口径（不依赖数据库）：
 * - percent：orderAmount × value / 100，四舍五入到分
 * - fixed：固定金额
 * - free_shipping：折扣为 0（免运费由运费计算处理）
 * - 折扣恒不超过订单金额（封顶）
 */
export function computeCouponDiscount(
  type: CouponDiscountType,
  value: string | number,
  orderAmount: string | number | Decimal,
): Decimal {
  const amount = new Decimal(orderAmount);

  if (type === 'free_shipping') {
    return new Decimal(0);
  }

  const discount = type === 'percent'
    ? new Decimal(value).mul(amount).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(value);

  return Decimal.min(discount, amount);
}
