import type { OrderStatus } from '../../../shared/api.interface';

/**
 * 订单状态机：卖家手动流转仅允许以下迁移（同一状态重复设置也会被拒绝）。
 * 支付入账（pending_payment → paid）与退款回写由对应服务负责，并同步库存/销量。
 */
export const ORDER_STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['shipped', 'delivered'],
  shipped: ['delivered'],
};

/** 判断一次状态迁移是否被允许（fail closed：未知当前状态一律禁止） */
export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}
