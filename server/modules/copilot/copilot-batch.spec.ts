import { describe, expect, it, vi } from 'vitest';
import { CopilotService } from './copilot.service';
import type { AiGatewayService } from '../ai/ai-gateway.service';
import type { CopilotToolService } from './copilot-tool.service';
import { copilotActions, copilotConversations } from '../../database/schema';

interface Row extends Record<string, unknown> {
  id: string;
}

/** 从 drizzle 条件对象里挖出目标 id（测试替身：按 id 精确定位被测行） */
function findIdInCondition(condition: unknown, ids: string[]): string | null {
  const seen = new Set<unknown>();
  const walk = (value: unknown): string | null => {
    if (typeof value === 'string') return ids.includes(value) ? value : null;
    if (!value || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(condition);
}

function fakeDb(seed: { conversations?: Row[]; actions?: Row[] }) {
  const tables = new Map<unknown, Row[]>([
    [copilotConversations, seed.conversations ?? []],
    [copilotActions, seed.actions ?? []],
  ]);
  return {
    select: () => ({
      from: (table: unknown) => {
        const source = tables.get(table) ?? [];
        let matched = source;
        const builder = {
          where: (condition?: unknown) => {
            if (condition) {
              const id = findIdInCondition(condition, source.map((row) => row.id));
              if (id) matched = source.filter((row) => row.id === id);
            }
            return builder;
          },
          orderBy: () => builder,
          limit: async (n: number) => matched.slice(0, n),
          groupBy: () => builder,
          then: (resolve: (value: Row[]) => void) => resolve(matched),
        };
        return builder;
      },
    }),
    insert: () => ({ values: () => ({ returning: async () => [] }) }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: (condition: unknown) => ({
          returning: async () => {
            const rows = tables.get(table) ?? [];
            const targetId = findIdInCondition(condition, rows.map((row) => row.id));
            const target = rows.find((row) => row.id === targetId) ?? rows[rows.length - 1];
            Object.assign(target, patch);
            return [target];
          },
        }),
      }),
    }),
    delete: () => ({ where: async () => undefined }),
    execute: async () => [],
  };
}

function gateway(): AiGatewayService {
  return { isConfigured: vi.fn(async () => true), chat: vi.fn() } as unknown as AiGatewayService;
}

const conversation: Row = {
  id: 'conv-1',
  userId: 'seller-1',
  title: 'x',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function actionRow(id: string, batchId: string, createdAtOffset: number): Row {
  return {
    id,
    conversationId: 'conv-1',
    userId: 'seller-1',
    toolName: 'update_order_status',
    kind: 'write',
    summary: `step ${id}`,
    args: JSON.stringify({ orderNo: 'ORD20261021ABC123', status: 'shipped' }),
    status: 'pending',
    batchId,
    result: null,
    errorMessage: null,
    createdAt: new Date(Date.now() + createdAtOffset),
    resolvedAt: null,
  };
}

// 行为契约（R2/R3）：整批审批按序执行，失败即停，不静默跳过
describe('CopilotService 批次审批', () => {
  it('R2: 整批批准按创建顺序执行全部步骤', async () => {
    const rows = [actionRow('a1', 'batch-1', 0), actionRow('a2', 'batch-1', 1000)];
    const tools = {
      runWriteTool: vi.fn(async () => ({ ok: true, content: 'ok' })),
    } as unknown as CopilotToolService;
    const service = new CopilotService(
      fakeDb({ conversations: [conversation], actions: rows }) as never,
      gateway(),
      tools,
    );

    const result = await service.resolveBatch('seller-1', 'seller', 'batch-1', true);

    expect(result.ok).toBe(true);
    expect(result.actions).toHaveLength(2);
    expect(result.actions.every((action) => action.status === 'executed')).toBe(true);
    expect(tools.runWriteTool).toHaveBeenCalledTimes(2);
  });

  it('R2: 中途失败即停，后续步骤保持 pending', async () => {
    const rows = [
      actionRow('a1', 'batch-2', 0),
      actionRow('a2', 'batch-2', 1000),
      actionRow('a3', 'batch-2', 2000),
    ];
    let call = 0;
    const tools = {
      runWriteTool: vi.fn(async () => {
        call += 1;
        if (call === 2) throw new Error('订单状态不允许');
        return { ok: true, content: 'ok' };
      }),
    } as unknown as CopilotToolService;
    const service = new CopilotService(
      fakeDb({ conversations: [conversation], actions: rows }) as never,
      gateway(),
      tools,
    );

    const result = await service.resolveBatch('seller-1', 'seller', 'batch-2', true);

    expect(result.ok).toBe(false);
    expect(result.actions.map((action) => action.status)).toEqual(['executed', 'failed']);
    expect(rows[2].status).toBe('pending');
    expect(tools.runWriteTool).toHaveBeenCalledTimes(2);
  });

  it('R3: 拒绝整批时全部标记 rejected 且不执行', async () => {
    const rows = [actionRow('a1', 'batch-3', 0), actionRow('a2', 'batch-3', 1000)];
    const tools = {
      runWriteTool: vi.fn(async () => ({ ok: true, content: 'ok' })),
    } as unknown as CopilotToolService;
    const service = new CopilotService(
      fakeDb({ conversations: [conversation], actions: rows }) as never,
      gateway(),
      tools,
    );

    const result = await service.resolveBatch('seller-1', 'seller', 'batch-3', false, '先不做');

    expect(result.ok).toBe(true);
    expect(result.actions.every((action) => action.status === 'rejected')).toBe(true);
    expect(tools.runWriteTool).not.toHaveBeenCalled();
  });
});
