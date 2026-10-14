import { describe, expect, it } from 'vitest';
import { canTransitionOrderStatus, ORDER_STATUS_TRANSITIONS } from './order-status';

// 行为契约（R7）：订单状态机 fail closed —— 仅允许显式声明的迁移
describe('order status transitions', () => {
  it('R7: 合法迁移通过', () => {
    expect(canTransitionOrderStatus('pending_payment', 'paid')).toBe(true);
    expect(canTransitionOrderStatus('pending_payment', 'cancelled')).toBe(true);
    expect(canTransitionOrderStatus('paid', 'shipped')).toBe(true);
    expect(canTransitionOrderStatus('paid', 'delivered')).toBe(true);
    expect(canTransitionOrderStatus('shipped', 'delivered')).toBe(true);
  });

  it('R7: 非法迁移拒绝（跳级/回退/原地）', () => {
    expect(canTransitionOrderStatus('pending_payment', 'shipped')).toBe(false);
    expect(canTransitionOrderStatus('pending_payment', 'delivered')).toBe(false);
    expect(canTransitionOrderStatus('pending_payment', 'pending_payment')).toBe(false);
    expect(canTransitionOrderStatus('paid', 'paid')).toBe(false);
    expect(canTransitionOrderStatus('paid', 'pending_payment')).toBe(false);
    expect(canTransitionOrderStatus('shipped', 'paid')).toBe(false);
    expect(canTransitionOrderStatus('delivered', 'pending_payment')).toBe(false);
  });

  it('R7: 终态与退款态不在人工迁移表中', () => {
    expect(ORDER_STATUS_TRANSITIONS.delivered).toBeUndefined();
    expect(ORDER_STATUS_TRANSITIONS.cancelled).toBeUndefined();
    expect(ORDER_STATUS_TRANSITIONS.refunded).toBeUndefined();
    expect(ORDER_STATUS_TRANSITIONS.partially_refunded).toBeUndefined();
    expect(canTransitionOrderStatus('cancelled', 'paid')).toBe(false);
    expect(canTransitionOrderStatus('refunded', 'shipped')).toBe(false);
  });
});
