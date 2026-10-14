import { describe, expect, it } from 'vitest';
import { resolveProviderRefundAmount } from './refund-amount';

// 行为契约（R3/R4）：
// R3 部分退款 MUST 向支付渠道传递明确的部分金额；全额退款 MUST 传 undefined（渠道按全额退回）
// R4 退款金额超过支付金额时 MUST 抛出错误（fail closed）

describe('resolveProviderRefundAmount', () => {
  it('R3: 部分退款返回明确金额', () => {
    expect(resolveProviderRefundAmount('100.00', '30.00')).toBe(30);
    expect(resolveProviderRefundAmount('100.00', '30.55')).toBe(30.55);
  });

  it('R3: 全额退款返回 undefined', () => {
    expect(resolveProviderRefundAmount('100.00', '100.00')).toBeUndefined();
    expect(resolveProviderRefundAmount('100.00', '100.001')).toBeUndefined();
  });

  it('R4: 超过支付金额抛错', () => {
    expect(() => resolveProviderRefundAmount('100.00', '100.01')).toThrow();
    expect(() => resolveProviderRefundAmount('100.00', '999.00')).toThrow();
  });

  it('R4: 非正数金额抛错', () => {
    expect(() => resolveProviderRefundAmount('100.00', '0')).toThrow();
    expect(() => resolveProviderRefundAmount('100.00', '-1')).toThrow();
  });
});
