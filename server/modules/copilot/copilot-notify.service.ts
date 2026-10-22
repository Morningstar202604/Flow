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
import {
  NotifyTransport,
  type NotifyConfig,
  type NotifyKind,
  type NotifyResult,
  type SmtpConfig,
} from './copilot-notify-transport';

export type NotifyChannelKind = NotifyKind;
export type { NotifyConfig, NotifyResult, SmtpConfig };

/**
 * 巡检通知出口（带重试与熔断）。
 *
 * 分层：
 * - `NotifyTransport`：只管"发一次"，返回是否可重试
 * - 本类：重试编排 + 按通道（webhook URL / SMTP host）隔离的熔断器
 *
 * 约束：
 * - 失败绝不抛出——通知失败不能影响巡检本身
 * - 永久性失败（配置错误/认证失败）不重试，直接计入熔断
 * - 熔断按通道隔离，一个坏 webhook 不影响邮件通道
 */
@Injectable()
export class CopilotNotifyService {
  private readonly logger = new Logger(CopilotNotifyService.name);
  private readonly breakers = new Map<string, BreakerState>();
  private readonly policy: RetryPolicy = DEFAULT_RETRY_POLICY;

  constructor(private readonly transport: NotifyTransport) {}

  async send(
    config: NotifyConfig,
    text: string,
    subject = '店铺巡检报告',
    html?: string,
  ): Promise<NotifyResult> {
    if (config.kind === 'none') {
      return { ok: false, channel: 'none', message: '未配置通知渠道', permanent: true };
    }

    const key = this.breakerKey(config);
    const breaker = this.breakers.get(key) ?? initialBreaker();
    const now = Date.now();
    if (!canAttempt(breaker, now)) {
      return { ok: false, channel: config.kind, message: formatBreakerNotice(breaker), attempts: 0 };
    }

    let last: NotifyResult = { ok: false, channel: config.kind, message: '未执行' };
    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt += 1) {
      last = await this.transport.deliver(config, subject, text, html);
      if (last.ok) {
        this.breakers.set(key, recordSuccess());
        return { ...last, attempts: attempt };
      }

      if (last.permanent) {
        const failedNow = recordFailure(breaker, Date.now());
        this.breakers.set(key, failedNow);
        return { ...last, attempts: attempt };
      }

      if (attempt < this.policy.maxAttempts) {
        await delay(backoffDelay(attempt, this.policy));
      }
    }

    const failed = recordFailure(breaker, Date.now());
    this.breakers.set(key, failed);
    const notice = formatBreakerNotice(failed);
    return {
      ...last,
      message: notice ? `${last.message}；${notice}` : last.message,
      attempts: this.policy.maxAttempts,
    };
  }

  /** 通道级熔断状态（供巡检摘要/排查） */
  getBreakerState(config: NotifyConfig): BreakerState {
    return this.breakers.get(this.breakerKey(config)) ?? initialBreaker();
  }

  /** 熔断键：同类通道按目标隔离（不同 webhook / 不同 SMTP 各自独立） */
  private breakerKey(config: NotifyConfig): string {
    if (config.kind === 'webhook') return `webhook:${config.url ?? ''}`;
    if (config.kind === 'email') return `email:${config.smtp?.host ?? ''}:${config.smtp?.to ?? ''}`;
    return 'none';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
