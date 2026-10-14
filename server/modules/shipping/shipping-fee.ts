import { Decimal } from 'decimal.js';

export interface ShippingTemplateLike {
  baseFee: string | number;
  extraFeePerUnit: string | number;
  freeShippingThreshold: string | number;
  unitType: string; // 'weight' | 'quantity'
  specialZones: string | null; // JSON: [{countries: string[], extraFee: string}]
}

export interface ShippingQuoteInput {
  country?: string;
  weightTotal?: number;
  qtyTotal?: number;
  subtotal: number;
}

export interface ShippingQuote {
  fee: string;
  freeShippingApplied: boolean;
}

/**
 * 运费计算唯一口径：
 * - 无模板 → 0.00
 * - 满额（subtotal >= freeShippingThreshold > 0）→ 0.00
 * - 首件/首 1kg 含在 baseFee，续件/超重按 extraFeePerUnit 线性加价
 * - 特殊地区加价命中一次；specialZones 损坏时退回基础运费
 */
export function computeShippingFee(
  template: ShippingTemplateLike | null,
  input: ShippingQuoteInput,
): ShippingQuote {
  if (!template) {
    return { fee: '0.00', freeShippingApplied: false };
  }

  const threshold = new Decimal(template.freeShippingThreshold ?? 0);
  if (threshold.gt(0) && new Decimal(input.subtotal).gte(threshold)) {
    return { fee: '0.00', freeShippingApplied: true };
  }

  let fee = new Decimal(template.baseFee ?? 0);
  const extraUnit = new Decimal(template.extraFeePerUnit ?? 0);

  if (template.unitType === 'weight') {
    const extraWeight = Math.max(0, (input.weightTotal ?? 0) - 1);
    fee = fee.plus(extraUnit.mul(extraWeight));
  } else {
    const extraQty = Math.max(0, (input.qtyTotal ?? 0) - 1);
    fee = fee.plus(extraUnit.mul(extraQty));
  }

  const country = input.country ?? '';
  if (template.specialZones && country) {
    try {
      const zones = JSON.parse(template.specialZones) as Array<{ countries: string[]; extraFee: string }>;
      const zone = zones.find((z) => Array.isArray(z.countries) && z.countries.includes(country));
      if (zone) {
        fee = fee.plus(new Decimal(zone.extraFee || 0));
      }
    } catch {
      // 模板配置损坏时退回基础运费
    }
  }

  return { fee: Decimal.max(fee, 0).toFixed(2), freeShippingApplied: false };
}
