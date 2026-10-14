import { Decimal } from 'decimal.js';

export interface PricingItem {
  unitPrice: string | number;
  quantity: number;
}

export interface OrderPricingInput {
  items: PricingItem[];
  /** 运费（由服务端按运费模板计算，客户端传入值一律忽略） */
  shippingFee?: string | number;
  /** 优惠券折扣金额（已完成资格与额度校验） */
  discountAmount?: string | number;
}

export interface OrderPricingResult {
  subtotal: string;
  shippingFee: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
}

const SCALE = 2;

/**
 * 订单金额唯一计算口径：subtotal + 运费 - 折扣 + 税额(=0)。
 * 折扣封顶于 subtotal + 运费，总额不为负；全程 Decimal，输出两位小数字符串。
 */
export function computeOrderPricing(input: OrderPricingInput): OrderPricingResult {
  const shipping = Decimal.max(new Decimal(input.shippingFee ?? 0), 0);
  const subtotal = input.items.reduce(
    (acc, item) => acc.plus(new Decimal(item.unitPrice).mul(item.quantity)),
    new Decimal(0),
  );

  const discountRequested = Decimal.max(new Decimal(input.discountAmount ?? 0), 0);
  const discountCap = subtotal.plus(shipping);
  const discount = Decimal.min(discountRequested, discountCap);

  const tax = new Decimal(0);
  const total = subtotal.plus(shipping).minus(discount).plus(tax);

  return {
    subtotal: subtotal.toFixed(SCALE),
    shippingFee: shipping.toFixed(SCALE),
    discountAmount: discount.toFixed(SCALE),
    taxAmount: tax.toFixed(SCALE),
    totalAmount: Decimal.max(total, 0).toFixed(SCALE),
  };
}
