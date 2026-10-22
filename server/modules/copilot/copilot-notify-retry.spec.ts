import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BREAKER,
  DEFAULT_RETRY_POLICY,
  backoffDelay,
  canAttempt,
  formatBreakerNotice,
  initialBreaker,
  recordFailure,
  recordSuccess,
} from './copilot-notify-retry';

// 行为契约（R21）：重试退避有上界；熔断器按阈值/冷却期正确切换
describe('notify retry & breaker', () => {
  it('R21: 退避按 2 的幂增长且不超过上限', () => {
    expect(backoffDelay(1)).toBe(DEFAULT_RETRY_POLICY.baseDelayMs);
    expect(backoffDelay(2)).toBe(DEFAULT_RETRY_POLICY.baseDelayMs * 2);
    expect(backoffDelay(3)).toBe(DEFAULT_RETRY_POLICY.baseDelayMs * 4);
    expect(backoffDelay(20)).toBe(DEFAULT_RETRY_POLICY.maxDelayMs);
  });

  it('R21: closed 状态允许尝试', () => {
    expect(canAttempt(initialBreaker(), Date.now())).toBe(true);
  });

  it('R21: 连续失败达阈值后熔断，冷却期内拒绝尝试', () => {
    let state = initialBreaker();
    const now = 1_000_000;
    for (let i = 0; i < DEFAULT_BREAKER.failureThreshold; i += 1) {
      state = recordFailure(state, now);
    }
    expect(state.status).toBe('open');
    expect(canAttempt(state, now + 1000)).toBe(false);
    expect(canAttempt(state, now + DEFAULT_BREAKER.cooldownMs)).toBe(true);
  });

  it('R21: 冷却期结束后进入 half-open 可重试', () => {
    let state = initialBreaker();
    state = recordFailure(state, 0);
    state = recordFailure(state, 0);
    state = recordFailure(state, 0);
    expect(canAttempt(state, DEFAULT_BREAKER.cooldownMs + 1)).toBe(true);
  });

  it('R21: 成功后重置为 closed 且计数清零', () => {
    let state = recordFailure(initialBreaker(), Date.now());
    state = recordSuccess();
    expect(state).toEqual(initialBreaker());
  });

  it('R21: 熔断提示包含失败次数', () => {
    const state = { status: 'open' as const, consecutiveFailures: 4, openedAt: 0 };
    expect(formatBreakerNotice(state)).toContain('连续失败 4 次');
    expect(formatBreakerNotice(initialBreaker())).toBe('');
  });
});
