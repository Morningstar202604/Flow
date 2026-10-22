import type { CopilotInsight } from '../../../shared/api.interface';

export type DigestFormat = 'plain' | 'markdown' | 'html';

const SEVERITY_ICON: Record<CopilotInsight['severity'], string> = {
  critical: '🔴',
  warning: '🟠',
  info: '🔵',
};

const SEVERITY_COLOR: Record<CopilotInsight['severity'], string> = {
  critical: '#dc2626',
  warning: '#d97706',
  info: '#0284c7',
};

const SEVERITY_LABEL: Record<CopilotInsight['severity'], string> = {
  critical: '严重',
  warning: '警告',
  info: '提示',
};

export interface DigestInput {
  insights: readonly CopilotInsight[];
  newInsights: readonly CopilotInsight[];
  /** 店铺名（可选，用于标题行） */
  storeName?: string;
  /** 生成时间（默认当前） */
  at?: Date;
}

/**
 * 按渠道渲染巡检摘要：
 * - plain：纯文本（日志 / 通用 webhook）
 * - markdown：飞书 / 钉钉 / 企微 的 markdown 消息体
 * - html：邮件正文
 * 三种格式共用同一份数据，避免"日志里有的信息通知里没有"。
 */
export function renderDigest(input: DigestInput, format: DigestFormat): string {
  const { insights, newInsights } = input;
  const at = input.at ?? new Date();
  const critical = insights.filter((item) => item.severity === 'critical').length;
  const header = input.storeName ? `${input.storeName} · 店铺巡检` : '店铺巡检';

  if (insights.length === 0) {
    if (format === 'html') {
      return `<p style="font-family:system-ui,sans-serif">${escapeHtml(header)}：<strong>暂无异常</strong></p>`;
    }
    return `${header}：暂无异常。`;
  }

  const summary = `${insights.length} 项待处理（严重 ${critical} 项），新增 ${newInsights.length} 项`;
  const timestamp = `${at.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

  if (format === 'plain') {
    const lines = [`${header} · ${timestamp}`, summary];
    for (const item of insights.slice(0, 10)) {
      lines.push(`[${SEVERITY_LABEL[item.severity]}] ${item.title}：${item.detail}`);
    }
    if (insights.length > 10) lines.push(`…另有 ${insights.length - 10} 项，请在「AI 运营副驾」查看`);
    return lines.join('\n');
  }

  if (format === 'markdown') {
    const lines = [
      `**${header}** · ${timestamp}`,
      '',
      summary,
    ];
    for (const item of insights.slice(0, 10)) {
      lines.push(`- ${SEVERITY_ICON[item.severity]} **${item.title}**：${item.detail}`);
    }
    if (insights.length > 10) lines.push(`- …另有 ${insights.length - 10} 项，请在「AI 运营副驾」查看`);
    return lines.join('\n');
  }

  // html
  const rows = insights.slice(0, 10).map((item) => `
    <tr>
      <td style="padding:6px 8px;white-space:nowrap;color:${SEVERITY_COLOR[item.severity]};font-weight:600">${SEVERITY_LABEL[item.severity]}</td>
      <td style="padding:6px 8px;font-weight:600">${escapeHtml(item.title)}</td>
      <td style="padding:6px 8px;color:#475569">${escapeHtml(item.detail)}</td>
    </tr>`).join('');

  return `<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a">
  <h2 style="margin:0 0 4px">${escapeHtml(header)}</h2>
  <p style="margin:0 0 12px;color:#64748b;font-size:13px">${escapeHtml(timestamp)}</p>
  <p style="margin:0 0 12px">${escapeHtml(summary)}</p>
  <table style="border-collapse:collapse;font-size:14px;width:100%">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="padding:6px 8px;text-align:left">级别</th>
        <th style="padding:6px 8px;text-align:left">问题</th>
        <th style="padding:6px 8px;text-align:left">详情</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${insights.length > 10 ? `<p style="color:#64748b;font-size:13px">…另有 ${insights.length - 10} 项，请在「AI 运营副驾」查看</p>` : ''}
</div>`;
}

/** 各渠道默认使用的格式 */
export function formatForChannel(kind: 'webhook' | 'email' | 'none'): DigestFormat {
  if (kind === 'email') return 'html';
  if (kind === 'webhook') return 'markdown';
  return 'plain';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
