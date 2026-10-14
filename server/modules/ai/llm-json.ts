import { BadGatewayException } from '@nestjs/common';

/**
 * 容错解析 LLM 返回的 JSON：
 * - 剥离 markdown 代码围栏（```json ... ```）
 * - 解析失败抛 502 Bad Gateway（明确的上游异常，而非 500 崩溃）
 */
export function parseLlmJson<T>(content: string): T {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new BadGatewayException('AI 返回内容不是有效 JSON，请重试');
  }
}
