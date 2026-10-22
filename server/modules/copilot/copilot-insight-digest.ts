import type { CopilotInsight } from '../../../shared/api.interface';

/** 单个实体是否在两个快照之间首次出现（用于"新告警"判定，避免重复通知） */
export function diffNewInsights(
  previous: readonly CopilotInsight[],
  current: readonly CopilotInsight[],
): CopilotInsight[] {
  const seen = new Set(previous.map((insight) => insightKey(insight)));
  return current.filter((insight) => !seen.has(insightKey(insight)));
}

/**
 * 告警稳定键：同一实体同一类型视为同一条告警。
 * 不使用 insight.id 里的时间/序号，保证跨次巡检可比。
 */
export function insightKey(insight: Pick<CopilotInsight, 'type' | 'entityId'>): string {
  return `${insight.type}:${insight.entityId ?? '-'}`;
}

/** 生成人类可读的巡检摘要（用于通知与日志） */
export function formatInsightDigest(
  insights: readonly CopilotInsight[],
  newInsights: readonly CopilotInsight[],
): string {
  if (insights.length === 0) return '店铺巡检：暂无异常。';
  const critical = insights.filter((insight) => insight.severity === 'critical').length;
  const lines = [
    `店铺巡检：${insights.length} 项待处理（严重 ${critical} 项），其中新增 ${newInsights.length} 项。`,
  ];
  if (newInsights.length > 0) {
    lines.push('新增：');
    for (const insight of newInsights.slice(0, 5)) {
      lines.push(`- [${insight.severity}] ${insight.title}：${insight.detail}`);
    }
  }
  return lines.join('\n');
}
