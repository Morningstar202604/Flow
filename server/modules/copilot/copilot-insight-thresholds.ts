import type { CopilotInsightThresholds } from '../../../shared/api.interface';

/** 默认巡检阈值（未配置时使用；卖家可在副驾「巡检设置」中调整） */
export const DEFAULT_INSIGHT_THRESHOLDS: CopilotInsightThresholds = {
  lowStock: 10,
  pendingRefundHours: 48,
  unpaidOrderHours: 24,
  staleShippedDays: 14,
};

/** 每项阈值的合法区间（与 DTO 校验保持一致，服务端二次收口） */
export const INSIGHT_THRESHOLD_RANGES: Record<keyof CopilotInsightThresholds, { min: number; max: number }> = {
  lowStock: { min: 0, max: 10000 },
  pendingRefundHours: { min: 1, max: 720 },
  unpaidOrderHours: { min: 1, max: 720 },
  staleShippedDays: { min: 1, max: 365 },
};

/**
 * 解析库里存的 JSON 阈值：逐字段校验，非法值一律回退默认（fail-safe，不让脏数据破坏巡检）。
 * 未知字段忽略，避免历史配置残留。
 */
export function mergeInsightThresholds(raw: string | null | undefined): CopilotInsightThresholds {
  const merged = { ...DEFAULT_INSIGHT_THRESHOLDS };
  if (!raw) return merged;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return merged;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return merged;

  for (const key of Object.keys(DEFAULT_INSIGHT_THRESHOLDS) as Array<keyof CopilotInsightThresholds>) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const range = INSIGHT_THRESHOLD_RANGES[key];
    if (value < range.min || value > range.max) continue;
    merged[key] = Math.round(value);
  }
  return merged;
}

/** 只保留已知字段并裁剪到合法区间（写入前调用） */
export function sanitizeInsightThresholds(
  input: Partial<Record<keyof CopilotInsightThresholds, unknown>>,
): Partial<CopilotInsightThresholds> {
  const sanitized: Partial<CopilotInsightThresholds> = {};
  for (const key of Object.keys(DEFAULT_INSIGHT_THRESHOLDS) as Array<keyof CopilotInsightThresholds>) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const range = INSIGHT_THRESHOLD_RANGES[key];
    sanitized[key] = Math.min(range.max, Math.max(range.min, Math.round(value)));
  }
  return sanitized;
}
