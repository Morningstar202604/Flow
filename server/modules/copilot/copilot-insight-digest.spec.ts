import { describe, expect, it } from 'vitest';
import { diffNewInsights, formatInsightDigest, insightKey } from './copilot-insight-digest';
import type { CopilotInsight } from '../../../shared/api.interface';

function insight(type: CopilotInsight['type'], entityId: string, severity: CopilotInsight['severity'] = 'warning'): CopilotInsight {
  return {
    id: `${type}-${entityId}`,
    type,
    severity,
    title: 't',
    detail: 'd',
    suggestion: 's',
    prompt: 'p',
    entityId,
  };
}

// 行为契约（R15）：定时巡检只对"新增"告警提醒，已存在的不重复
describe('insight digest', () => {
  it('R15: 同一实体同类型视为同一条告警', () => {
    expect(insightKey(insight('low_stock', 'p1'))).toBe(insightKey(insight('low_stock', 'p1')));
    expect(insightKey(insight('low_stock', 'p1'))).not.toBe(insightKey(insight('stale_refund', 'p1')));
  });

  it('R15: diff 只返回新出现的告警', () => {
    const previous = [insight('low_stock', 'p1'), insight('stale_refund', 'r1')];
    const current = [insight('low_stock', 'p1'), insight('low_stock', 'p2'), insight('stale_refund', 'r1')];

    const fresh = diffNewInsights(previous, current);

    expect(fresh.map((item) => item.entityId)).toEqual(['p2']);
  });

  it('R15: 无告警时摘要明确说明无异常', () => {
    expect(formatInsightDigest([], [])).toBe('店铺巡检：暂无异常。');
  });

  it('R15: 摘要包含总数、严重数与新增明细', () => {
    const all = [insight('stale_refund', 'r1', 'critical'), insight('low_stock', 'p1')];
    const text = formatInsightDigest(all, [all[0]]);
    expect(text).toContain('2 项待处理');
    expect(text).toContain('严重 1 项');
    expect(text).toContain('新增 1 项');
    expect(text).toContain('新增：');
  });
});
