import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INSIGHT_THRESHOLDS,
  INSIGHT_THRESHOLD_RANGES,
  mergeInsightThresholds,
  sanitizeInsightThresholds,
} from './copilot-insight-thresholds';

// 行为契约（R10）：阈值配置脏数据必须回退默认，不破坏巡检
describe('insight thresholds', () => {
  it('R10: 无配置时返回默认值', () => {
    expect(mergeInsightThresholds(null)).toEqual(DEFAULT_INSIGHT_THRESHOLDS);
    expect(mergeInsightThresholds(undefined)).toEqual(DEFAULT_INSIGHT_THRESHOLDS);
    expect(mergeInsightThresholds('')).toEqual(DEFAULT_INSIGHT_THRESHOLDS);
  });

  it('R10: 非法 JSON / 非对象回退默认', () => {
    expect(mergeInsightThresholds('{not json')).toEqual(DEFAULT_INSIGHT_THRESHOLDS);
    expect(mergeInsightThresholds('[1,2,3]')).toEqual(DEFAULT_INSIGHT_THRESHOLDS);
    expect(mergeInsightThresholds('"str"')).toEqual(DEFAULT_INSIGHT_THRESHOLDS);
  });

  it('R10: 逐字段合并，越界字段单独回退', () => {
    const merged = mergeInsightThresholds(JSON.stringify({ lowStock: 3, unpaidOrderHours: 9999 }));
    expect(merged.lowStock).toBe(3);
    expect(merged.unpaidOrderHours).toBe(DEFAULT_INSIGHT_THRESHOLDS.unpaidOrderHours);
    expect(merged.pendingRefundHours).toBe(DEFAULT_INSIGHT_THRESHOLDS.pendingRefundHours);
  });

  it('R10: 未知字段被忽略，不污染结果', () => {
    const merged = mergeInsightThresholds(JSON.stringify({ lowStock: 5, hacker: 1 }));
    expect(merged).toEqual({ ...DEFAULT_INSIGHT_THRESHOLDS, lowStock: 5 });
    expect('hacker' in merged).toBe(false);
  });

  it('R10: 小数被四舍五入为整数', () => {
    expect(mergeInsightThresholds(JSON.stringify({ lowStock: 7.6 })).lowStock).toBe(8);
  });

  it('R10: sanitize 裁剪到合法区间并丢弃非数字', () => {
    const sanitized = sanitizeInsightThresholds({
      lowStock: -5,
      pendingRefundHours: 99999,
      staleShippedDays: 'abc',
    });
    expect(sanitized.lowStock).toBe(INSIGHT_THRESHOLD_RANGES.lowStock.min);
    expect(sanitized.pendingRefundHours).toBe(INSIGHT_THRESHOLD_RANGES.pendingRefundHours.max);
    expect('staleShippedDays' in sanitized).toBe(false);
  });
});
