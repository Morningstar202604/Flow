import { describe, expect, it } from 'vitest';
import { computeShippingFee, type ShippingTemplateLike } from './shipping-fee';

// 行为契约（R5/R6）：
// R5 首件（或首 1kg）含在基础运费内，续件按 extraFeePerUnit 加价
// R6 满额免运费优先于一切加价；特殊地区加价仅命中一次；无模板时运费为 0.00

const qtyTemplate: ShippingTemplateLike = {
  baseFee: '5.00',
  extraFeePerUnit: '2.00',
  freeShippingThreshold: '100.00',
  unitType: 'quantity',
  specialZones: null,
};

const weightTemplate: ShippingTemplateLike = {
  baseFee: '8.00',
  extraFeePerUnit: '3.00',
  freeShippingThreshold: '0',
  unitType: 'weight',
  specialZones: JSON.stringify([{ countries: ['US'], extraFee: '4.00' }]),
};

describe('computeShippingFee', () => {
  it('R5: 按件计费 — 首件含基础运费，续件加价', () => {
    expect(computeShippingFee(qtyTemplate, { qtyTotal: 1, subtotal: 50 }).fee).toBe('5.00');
    expect(computeShippingFee(qtyTemplate, { qtyTotal: 3, subtotal: 50 }).fee).toBe('9.00');
  });

  it('R5: 按重计费 — 首 1kg 含基础运费，超重加价', () => {
    expect(computeShippingFee(weightTemplate, { weightTotal: 1, subtotal: 10 }).fee).toBe('8.00');
    expect(computeShippingFee(weightTemplate, { weightTotal: 2.5, subtotal: 10 }).fee).toBe('12.50');
  });

  it('R6: 满额免运费优先于加价', () => {
    const quote = computeShippingFee(qtyTemplate, { qtyTotal: 10, subtotal: 120 });
    expect(quote.fee).toBe('0.00');
    expect(quote.freeShippingApplied).toBe(true);
  });

  it('R6: 特殊地区加价命中一次', () => {
    expect(computeShippingFee(weightTemplate, { country: 'US', weightTotal: 1, subtotal: 10 }).fee).toBe('12.00');
    expect(computeShippingFee(weightTemplate, { country: 'CN', weightTotal: 1, subtotal: 10 }).fee).toBe('8.00');
  });

  it('R6: 无模板返回 0.00', () => {
    expect(computeShippingFee(null, { qtyTotal: 5, subtotal: 999 }).fee).toBe('0.00');
  });

  it('R6: specialZones 配置损坏时退回基础运费', () => {
    const broken = { ...weightTemplate, specialZones: '{not json' };
    expect(computeShippingFee(broken, { country: 'US', weightTotal: 1, subtotal: 10 }).fee).toBe('8.00');
  });
});
