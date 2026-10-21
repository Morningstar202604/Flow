import type { ChatMessage } from '../ai/ai-gateway.service';
import type { CopilotToolKind } from '../../../shared/api.interface';

export interface CopilotParamSpec {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  description: string;
  enum?: readonly string[];
  min?: number;
  max?: number;
  integer?: boolean;
  pattern?: RegExp;
  maxLength?: number;
}

export interface CopilotToolDefinition {
  name: string;
  description: string;
  kind: CopilotToolKind;
  params: readonly CopilotParamSpec[];
  /** 写操作展示给卖家确认的一句话说明 */
  summarize?: (args: Record<string, unknown>) => string;
}

export type CopilotDecision =
  | { type: 'final'; reply: string }
  | { type: 'tool'; tool: string; args: Record<string, unknown>; thought?: string; plan?: string }
  | { type: 'invalid'; error: string };

export interface ToolArgValidation {
  ok: boolean;
  args: Record<string, unknown>;
  errors: string[];
}

/** 解析模型输出：优先 JSON 协议；不合法时降级为纯文本回答（真实模型并非总能守格式） */
export function parseCopilotDecision(content: string): CopilotDecision {
  const raw = (content ?? '').trim();
  if (!raw) {
    return { type: 'invalid', error: '模型返回为空' };
  }

  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  const candidates = [stripped];
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(stripped.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith('{')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (!isPlainObject(parsed)) continue;

    const tool = parsed.tool;
    if (typeof tool === 'string' && tool.trim().length > 0) {
      const args = isPlainObject(parsed.args) ? parsed.args : {};
      const thought = typeof parsed.thought === 'string' ? parsed.thought : undefined;
      const plan = typeof parsed.plan === 'string' ? parsed.plan : undefined;
      return { type: 'tool', tool: tool.trim(), args, thought, plan };
    }

    const finalText = firstNonEmptyString(parsed.final, parsed.reply, parsed.message);
    if (finalText) {
      return { type: 'final', reply: finalText };
    }
  }

  // 非 JSON：视为普通文本回答（不臆造工具调用）
  return { type: 'final', reply: stripped };
}

export function validateToolArgs(
  definition: CopilotToolDefinition,
  rawArgs: Record<string, unknown> | undefined,
): ToolArgValidation {
  const errors: string[] = [];
  const args: Record<string, unknown> = {};
  const input = isPlainObject(rawArgs) ? rawArgs : {};

  const allowed = new Set(definition.params.map((p) => p.name));
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      errors.push(`未知参数 "${key}"`);
    }
  }

  for (const spec of definition.params) {
    const raw = input[spec.name];
    const missing = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');

    if (missing) {
      if (spec.required) errors.push(`缺少必填参数 "${spec.name}"`);
      continue;
    }

    if (spec.type === 'string') {
      if (typeof raw !== 'string') {
        errors.push(`参数 "${spec.name}" 应为字符串`);
        continue;
      }
      const value = raw.trim();
      const maxLength = spec.maxLength ?? 500;
      if (value.length > maxLength) {
        errors.push(`参数 "${spec.name}" 超过 ${maxLength} 字符`);
        continue;
      }
      if (spec.enum && !spec.enum.includes(value)) {
        errors.push(`参数 "${spec.name}" 取值必须是 ${spec.enum.join(' / ')}`);
        continue;
      }
      if (spec.pattern && !spec.pattern.test(value)) {
        errors.push(`参数 "${spec.name}" 格式不合法`);
        continue;
      }
      args[spec.name] = value;
      continue;
    }

    if (spec.type === 'number') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        errors.push(`参数 "${spec.name}" 应为数字`);
        continue;
      }
      if (spec.integer && !Number.isInteger(raw)) {
        errors.push(`参数 "${spec.name}" 应为整数`);
        continue;
      }
      if (spec.min !== undefined && raw < spec.min) {
        errors.push(`参数 "${spec.name}" 不能小于 ${spec.min}`);
        continue;
      }
      if (spec.max !== undefined && raw > spec.max) {
        errors.push(`参数 "${spec.name}" 不能大于 ${spec.max}`);
        continue;
      }
      args[spec.name] = raw;
      continue;
    }

    if (typeof raw !== 'boolean') {
      errors.push(`参数 "${spec.name}" 应为布尔值`);
      continue;
    }
    args[spec.name] = raw;
  }

  return { ok: errors.length === 0, args, errors };
}

/** 生成给模型看的工具目录（与注册表同源，杜绝文档漂移） */
export function buildToolCatalog(definitions: readonly CopilotToolDefinition[]): string {
  return definitions
    .map((def) => {
      const params = def.params.length === 0
        ? '无参数'
        : def.params
          .map((p) => {
            const flags = [p.required ? '必填' : '可选', p.enum ? `取值 ${p.enum.join('|')}` : '']
              .filter(Boolean)
              .join('，');
            return `${p.name}:${p.type}（${flags || '可选'}，${p.description}）`;
          })
          .join('；');
      return `- ${def.name} [${def.kind === 'read' ? '只读' : '写操作需人工批准'}]：${def.description}\n  参数：${params}`;
    })
    .join('\n');
}

const MAX_HISTORY_MESSAGES = 30;

/** 将库里的消息按协议折叠为对话历史（工具消息以带前缀的 user 消息回放） */
export function toChatHistory(
  rows: Array<{ role: string; content: string; toolName: string | null }>,
): ChatMessage[] {
  const recent = rows.slice(-MAX_HISTORY_MESSAGES);
  const messages: ChatMessage[] = [];
  for (const row of recent) {
    if (row.role === 'user') {
      messages.push({ role: 'user', content: row.content });
    } else if (row.role === 'assistant') {
      messages.push({ role: 'assistant', content: row.content });
    } else if (row.role === 'tool') {
      messages.push({
        role: 'user',
        content: `[工具 ${row.toolName ?? 'unknown'} 的执行结果]\n${row.content}`,
      });
    }
  }
  return messages;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
