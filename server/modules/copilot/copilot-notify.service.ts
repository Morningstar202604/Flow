import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_RETRY_POLICY,
  backoffDelay,
  canAttempt,
  formatBreakerNotice,
  initialBreaker,
  recordFailure,
  recordSuccess,
  type BreakerState,
  type RetryPolicy,
} from './copilot-notify-retry';

export type NotifyChannelKind = 'webhook' | 'none';

export interface NotifyConfig {
  kind: NotifyChannelKind;
  /** Webhook 地址（飞书/企业微信/钉钉/Slack 通用：POST JSON { text }） */
  url?: string;
}

export interface NotifyResult {
  ok: boolean;
  channel: NotifyChannelKind;
  message: string;
  /** 实际尝试次数（含首次） */
  attempts?: number;
}

/**
 * 巡检通知出口：只用 HTTP webhook（零新依赖，覆盖飞书/企微/钉钉/Slack）。
 *
 * 可靠性：
 * - 指数退避重试（默认 3 次：立即 → ~0.4s → ~0.8s）
 * - 连续失败达阈值的通道熔断 5 分钟，避免每轮巡检都打一个坏端点
 * - 失败绝不抛出——通知失败不能影响巡检本身
 * - 只对**配置本身**（URL/格式）做永久性失败判定，网络/5xx 才重试
 */
@Injectable()
export class CopilotNotifyService {
  private readonly logger = new Logger(CopilotNotifyService.name);
  private readonly breakers = new Map<string, BreakerState>();
  private readonly policy: RetryPolicy = DEFAULT_RETRY_POLICY;

  async send(config: NotifyConfig, text: string): Promise<NotifyResult> {
    if (config.kind === 'none' || !config.url) {
      return { ok: false, channel: 'none', message: '未配置通知渠道' };
    }

    if (!/^https?:\/\//i.test(config.url)) {
      return { ok: false, channel: config.kind, message: 'Webhook 地址必须以 http(s):// 开头' };
    }

    const key = config.url;
    const breaker = this.breakers.get(key) ?? initialBreaker();
    const now = Date.now();
    if (!canAttempt(breaker, now)) {
      return {
        ok: false,
        channel: config.kind,
        message: formatBreakerNotice(breaker),
        attempts: 0,
      };
    }

    let lastMessage = '';
    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt += 1) {
      const result = await this.attemptOnce(config.url, text);
      if (result.ok) {
        this.breakers.set(key, recordSuccess());
        return { ...result, attempts: attempt };
      }

      lastMessage = result.message;
      // 配置类错误（非瞬态）不重试
      if (!result.retryable) {
        this.breakers.set(key, recordFailure(breaker, Date.now()));
        return { ...result, attempts: attempt };
      }

      if (attempt < this.policy.maxAttempts) {
        await delay(backoffDelay(attempt, this.policy));
      }
    }

    const failed = recordFailure(breaker, Date.now());
    this.breakers.set(key, failed);
    const notice = formatBreakerNotice(failed);
    return {
      ok: false,
      channel: config.kind,
      message: notice ? `${lastMessage}；${notice}` : lastMessage,
      attempts: this.policy.maxAttempts,
    };
  }

  /** 当前某通道的熔断状态（供巡检摘要/排查使用） */
  getBreakerState(url: string): BreakerState {
    return this.breakers.get(url) ?? initialBreaker();
  }

  private async attemptOnce(
    url: string,
    text: string,
  ): Promise<{ ok: boolean; channel: NotifyChannelKind; message: string; retryable: boolean }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, msgtype: 'text', content: { text } }),
          signal: controller.signal,
        });
        if (!response.ok) {
          return {
            ok: false,
            channel: 'webhook',
            message: `Webhook 返回 HTTP ${response.status}`,
            retryable: response.status >= 500 || response.status === 429,
          };
        }
        return { ok: true, channel: 'webhook', message: '通知已发送', retryable: false };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`巡检通知发送失败：${message}`);
      return { ok: false, channel: 'webhook', message: `通知发送失败：${message}`, retryable: true };
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
