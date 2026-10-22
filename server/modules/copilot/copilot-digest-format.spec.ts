import { describe, expect, it } from 'vitest';
import { formatForChannel, renderDigest } from './copilot-digest-format';
import type { CopilotInsight } from '../../../shared/api.interface';

function insight(
  severity: CopilotInsight['severity'],
  overrides: Partial<CopilotInsight> = {},
): CopilotInsight {
  return {
    id: 'x',
    type: 'low_stock',
    severity,
    title: '库存偏低',
    detail: '商品A 当前库存 2',
    suggestion: '补货',
    prompt: 'p',
    entityId: 'e1',
    ...overrides,
  };
}

const at = new Date('2026-10-22T08:30:00.000Z');

// 行为契约（R26）：三种渠道格式都含同样关键信息；HTML 做转义
describe('renderDigest', () => {
  it('R26: plain 含时间、统计与逐条明细', () => {
    const text = renderDigest({ insights: [insight('critical')], newInsights: [insight('critical')], at }, 'plain');
    expect(text).toContain('2026-10-22 08:30');
    expect(text).toContain('1 项待处理（严重 1 项），新增 1 项');
    expect(text).toContain('[严重] 库存偏低');
  });

  it('R26: markdown 用列表与 emoji 级别', () => {
    const text = renderDigest({ insights: [insight('warning')], newInsights: [], at }, 'markdown');
    expect(text).toContain('- 🟠 **库存偏低**');
  });

  it('R26: html 输出表格且转义特殊字符', () => {
    const text = renderDigest(
      { insights: [insight('warning', { detail: '<script>alert(1)</script>' })], newInsights: [], at },
      'html',
    );
    expect(text).toContain('<table');
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
  });

  it('R26: 无告警时三格式都给出"暂无异常"', () => {
    expect(renderDigest({ insights: [], newInsights: [], at }, 'plain')).toContain('暂无异常');
    expect(renderDigest({ insights: [], newInsights: [], at }, 'markdown')).toContain('暂无异常');
    expect(renderDigest({ insights: [], newInsights: [], at }, 'html')).toContain('暂无异常');
  });

  it('R26: 超过 10 条时截断并提示剩余数量', () => {
    const many = Array.from({ length: 13 }, (_, i) => insight('warning', { entityId: `e${i}` }));
    const text = renderDigest({ insights: many, newInsights: many, at }, 'plain');
    expect(text).toContain('另有 3 项');
  });

  it('R26: 渠道默认格式映射正确', () => {
    expect(formatForChannel('email')).toBe('html');
    expect(formatForChannel('webhook')).toBe('markdown');
    expect(formatForChannel('none')).toBe('plain');
  });

  it('R26: 店铺名出现在标题行', () => {
    const text = renderDigest(
      { insights: [insight('info')], newInsights: [], at, storeName: 'Flow 旗舰店' },
      'plain',
    );
    expect(text.startsWith('Flow 旗舰店 · 店铺巡检')).toBe(true);
  });
});
