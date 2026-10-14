import { Decimal } from 'decimal.js';

/**
 * 决定向支付渠道传递的退款金额：
 * - 部分退款：返回明确的数字金额（避免渠道按默认全额退回，账实不符）
 * - 全额退款：返回 undefined（渠道默认按支付全额退回）
 * - 金额非正或超过支付金额：抛 RangeError（fail closed）
 *
 * 金额口径统一为两位小数（与数据库 decimal(12,2) 一致）后再比较。
 */
export function resolveProviderRefundAmount(
  paymentAmount: string | number,
  refundAmount: string | number,
): number | undefined {
  const paid = new Decimal(paymentAmount).toDecimalPlaces(2);
  const refund = new Decimal(refundAmount).toDecimalPlaces(2);

  if (refund.lte(0)) {
    throw new RangeError(`退款金额必须大于 0: ${refund.toFixed(2)}`);
  }
  if (refund.gt(paid)) {
    throw new RangeError(`退款金额 ${refund.toFixed(2)} 超过支付金额 ${paid.toFixed(2)}`);
  }
  if (refund.eq(paid)) {
    return undefined;
  }
  return Number(refund);
}
