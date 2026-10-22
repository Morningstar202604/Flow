export interface RetryPolicy {
  /** 最大尝试次数（含首次） */
  maxAttempts: number;
  /** 首次退避毫秒 */
  baseDelayMs: number;
  /** 退避上限 */
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 400,
  maxDelayMs: 4000,
};

/** 指数退避序列（含随机抖动上限，便于测试断言区间） */
export function backoffDelay(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const raw = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(policy.maxDelayMs, raw);
}

/**
 * 熔断器状态机（纯函数式判定，便于单测）：
 * closed --连续失败达阈值--> open --冷却期结束--> half_open --成功--> closed
 *                                                  \--失败--> open
 */
export interface BreakerState {
  status: 'closed' | 'open' | 'half_open';
  consecutiveFailures: number;
  openedAt: number | null;
}

export const DEFAULT_BREAKER = {
  failureThreshold: 3,
  cooldownMs: 5 * 60 * 1000,
} as const;

export function initialBreaker(): BreakerState {
  return { status: 'closed', consecutiveFailures: 0, openedAt: null };
}

export function canAttempt(state: BreakerState, now: number, cooldownMs = DEFAULT_BREAKER.cooldownMs): boolean {
  if (state.status === 'closed') return true;
  if (state.status === 'open') {
    return state.openedAt !== null && now - state.openedAt >= cooldownMs;
  }
  return true;
}

export function recordSuccess(): BreakerState {
  return initialBreaker();
}

export function recordFailure(
  state: BreakerState,
  now: number,
  threshold = DEFAULT_BREAKER.failureThreshold,
): BreakerState {
  const failures = state.consecutiveFailures + 1;
  if (failures >= threshold) {
    return { status: 'open', consecutiveFailures: failures, openedAt: now };
  }
  return { status: state.status === 'open' ? 'open' : 'closed', consecutiveFailures: failures, openedAt: state.openedAt };
}

/** 人类可读的熔断提示（写入巡检摘要用） */
export function formatBreakerNotice(state: BreakerState): string {
  if (state.status === 'open') {
    return `通知通道已熔断（连续失败 ${state.consecutiveFailures} 次），冷却后自动重试`;
  }
  return '';
}
