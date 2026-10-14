import { describe, expect, it } from 'vitest';
import { computeOrderPricing } from './order-pricing';

// 行为契约（R1/R2）：
// R1 订单总额 MUST 等于 subtotal + 运费 - 折扣 + 税额，且输出两位小数字符串
// R2 折扣 MUST 封顶于 subtotal + 运费，总额 MUST NOT 为负

describe('computeOrderPricing', () => {
  it('R1: 多商品小计 + 运费 - 折扣，输出两位小数', () => {
    const result = computeOrderPricing({
      items: [
        { unitPrice: '12.50', quantity: 2 },
        { unitPrice: '3.33', quantity: 3 },
      ],
      shippingFee: '8.00',
      discountAmount: '5.00',
    });
    expect(result.subtotal).toBe('34.99');
    expect(result.shippingFee).toBe('8.00');
    expect(result.discountAmount).toBe('5.00');
    expect(result.taxAmount).toBe('0.00');
    expect(result.totalAmount).toBe('37.99');
  });

  it('R1: 无运费无折扣时总额等于小计', () => {
    const result = computeOrderPricing({ items: [{ unitPrice: 9.9, quantity: 1 }] });
    expect(result.totalAmount).toBe('9.90');
  });

  it('R2: 折扣超过小计+运费时封顶，总额不为负', () => {
    const result = computeOrderPricing({
      items: [{ unitPrice: '20.00', quantity: 1 }],
      shippingFee: '5.00',
      discountAmount: '100.00',
    });
    expect(result.discountAmount).toBe('25.00');
    expect(result.totalAmount).toBe('0.00');
  });

  it('R2: 负数折扣按 0 处理', () => {
    const result = computeOrderPricing({
      items: [{ unitPrice: '10.00', quantity: 1 }],
      discountAmount: '-5.00',
    });
    expect(result.discountAmount).toBe('0.00');
    expect(result.totalAmount).toBe('10.00');
  });

  it('R1: 浮点商品单价（0.1 * 3）不产生浮点误差', () => {
    const result = computeOrderPricing({ items: [{ unitPrice: 0.1, quantity: 3 }] });
    expect(result.subtotal).toBe('0.30');
  });
});
