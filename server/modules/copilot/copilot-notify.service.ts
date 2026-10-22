import { Injectable, Logger } from '@nestjs/common';

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
}

/**
 * 巡检通知出口：只用 HTTP webhook（零新依赖，覆盖飞书/企微/钉钉/Slack）。
 * 失败绝不抛出——通知失败不能影响巡检本身。
 */
@Injectable()
export class CopilotNotifyService {
  private readonly logger = new Logger(CopilotNotifyService.name);

  async send(config: NotifyConfig, text: string): Promise<NotifyResult> {
    if (config.kind === 'none' || !config.url) {
      return { ok: false, channel: 'none', message: '未配置通知渠道' };
    }

    if (!/^https?:\/\//i.test(config.url)) {
      return { ok: false, channel: config.kind, message: 'Webhook 地址必须以 http(s):// 开头' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, msgtype: 'text', content: { text } }),
          signal: controller.signal,
        });
        if (!response.ok) {
          return { ok: false, channel: config.kind, message: `Webhook 返回 HTTP ${response.status}` };
        }
        return { ok: true, channel: config.kind, message: '通知已发送' };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`巡检通知发送失败：${message}`);
      return { ok: false, channel: config.kind, message: `通知发送失败：${message}` };
    }
  }
}
