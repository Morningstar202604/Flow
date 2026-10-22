import { describe, expect, it, vi } from 'vitest';
import { ShopperService } from './shopper.service';
import type { AiGatewayService } from '../ai/ai-gateway.service';
import type { ShopperToolService } from './shopper-tool.service';
import type { ShopperAnalyticsService } from './shopper-analytics.service';
import { copilotActions, copilotConversations, copilotMessages } from '../../database/schema';

interface Row extends Record<string, unknown> {
  id: string;
}

function fakeDb(seed: { conversations?: Row[]; actions?: Row[]; messages?: Row[] }) {
  const tables = new Map<unknown, Row[]>([
    [copilotConversations, seed.conversations ?? []],
    [copilotMessages, seed.messages ?? []],
    [copilotActions, seed.actions ?? []],
  ]);
  let seq = 0;
  return {
    select: () => ({
      from: (table: unknown) => {
        const rows = tables.get(table) ?? [];
        const builder = {
          where: () => builder,
          orderBy: () => builder,
          limit: async (n: number) => rows.slice(0, n),
          groupBy: () => builder,
          then: (resolve: (value: Row[]) => void) => resolve(rows),
        };
        return builder;
      },
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          seq += 1;
          const row: Row = {
            id: `row-${seq}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            resolvedAt: null,
            ...values,
          };
          (tables.get(table) ?? []).push(row);
          return [row];
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            const rows = tables.get(table) ?? [];
            const target = rows[rows.length - 1];
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

function analytics(): ShopperAnalyticsService {
  return { track: vi.fn(async () => undefined), getFunnel: vi.fn() } as unknown as ShopperAnalyticsService;
}

function gateway(script: Array<Record<string, unknown>>, configured = true) {
  let index = 0;
  return {
    isConfigured: vi.fn(async () => configured),
    chat: vi.fn(async () => ({
      content: JSON.stringify(script[Math.min(index++, script.length - 1)]),
    })),
  } as unknown as AiGatewayService;
}

const conversation: Row = {
  id: 'conv-shopper',
  userId: 'buyer-1',
  sessionId: null,
  title: '新对话',
  channel: 'shopper',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 行为契约（R9）：导购的加购同样走人工确认；匿名会话按 sessionId 隔离
describe('ShopperService', () => {
  it('R9: 加购请求只生成 pending 动作，不直接写购物车', async () => {
    const tools = {
      runReadTool: vi.fn(async () => ({ ok: true, content: '找到 1 个商品' })),
      runWriteTool: vi.fn(async () => ({ ok: true, content: '已加入购物车' })),
    } as unknown as ShopperToolService;
    const service = new ShopperService(
      fakeDb({ conversations: [conversation] }) as never,
      gateway([{ tool: 'add_to_cart', args: { productId: '11111111-1111-4111-8111-111111111111', quantity: 1 } }, { final: '请确认加购' }]),
      tools,
      analytics(),
    );

    const result = await service.sendMessage({ userId: 'buyer-1' }, 'conv-shopper', '把这个加入购物车');

    expect(tools.runWriteTool).not.toHaveBeenCalled();
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].status).toBe('pending');
    expect(result.actions[0].toolName).toBe('add_to_cart');
  });

  it('R9: 确认后才调用购物车服务', async () => {
    const action: Row = {
      id: 'act-1',
      conversationId: 'conv-shopper',
      userId: 'buyer-1',
      sessionId: null,
      toolName: 'add_to_cart',
      kind: 'write',
      summary: '加购',
      args: JSON.stringify({ productId: '11111111-1111-4111-8111-111111111111', quantity: 2 }),
      status: 'pending',
      createdAt: new Date(),
      resolvedAt: null,
    };
    const tools = {
      runReadTool: vi.fn(),
      runWriteTool: vi.fn(async () => ({ ok: true, content: '已加入购物车，当前共 2 件' })),
    } as unknown as ShopperToolService;
    const service = new ShopperService(
      fakeDb({ conversations: [conversation], actions: [action] }) as never,
      gateway([{ final: 'ok' }]),
      tools,
      analytics(),
    );

    const result = await service.resolveAction({ userId: 'buyer-1' }, 'act-1', true);

    expect(tools.runWriteTool).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.action.status).toBe('executed');
  });

  it('R9: 其他买家的动作不可确认（越权）', async () => {
    const action: Row = {
      id: 'act-2',
      conversationId: 'conv-shopper',
      userId: 'buyer-2',
      sessionId: null,
      toolName: 'add_to_cart',
      kind: 'write',
      summary: '加购',
      args: '{}',
      status: 'pending',
      createdAt: new Date(),
      resolvedAt: null,
    };
    const service = new ShopperService(
      fakeDb({ conversations: [conversation], actions: [action] }) as never,
      gateway([{ final: 'ok' }]),
      { runReadTool: vi.fn(), runWriteTool: vi.fn() } as unknown as ShopperToolService,
      analytics(),
    );

    await expect(service.resolveAction({ userId: 'buyer-1' }, 'act-2', true)).rejects.toThrow('操作不存在');
  });

  it('R9: 匿名会话用 sessionId 归属，其他 session 打不开', async () => {
    const anonConversation: Row = {
      id: 'conv-anon',
      userId: null,
      sessionId: 'session-abc-123',
      title: '新对话',
      channel: 'shopper',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = new ShopperService(
      fakeDb({ conversations: [anonConversation] }) as never,
      gateway([{ final: 'ok' }]),
      { runReadTool: vi.fn(), runWriteTool: vi.fn() } as unknown as ShopperToolService,
      analytics(),
    );

    const ok = await service.getConversationDetail({ sessionId: 'session-abc-123' }, 'conv-anon');
    expect(ok.conversation.id).toBe('conv-anon');

    await expect(
      service.getConversationDetail({ sessionId: 'session-other-456' }, 'conv-anon'),
    ).rejects.toThrow('对话不存在');
  });

  it('R9: 未配置模型时诚实拒绝', async () => {
    const service = new ShopperService(
      fakeDb({ conversations: [conversation] }) as never,
      gateway([{ final: 'ok' }], false),
      { runReadTool: vi.fn(), runWriteTool: vi.fn() } as unknown as ShopperToolService,
      analytics(),
    );

    await expect(
      service.sendMessage({ userId: 'buyer-1' }, 'conv-shopper', '推荐耳机'),
    ).rejects.toThrow('AI 导购暂未开启');
  });
});
