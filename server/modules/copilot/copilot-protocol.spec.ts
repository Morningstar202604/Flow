import { describe, expect, it } from 'vitest';
import {
  buildToolCatalog,
  parseCopilotDecision,
  toChatHistory,
  validateToolArgs,
} from './copilot-protocol';
import { COPILOT_TOOLS, getTool, isWritableTool } from './copilot-tools';

// 行为契约（R1/R2）：模型决策解析 + 工具参数校验是写操作门禁的第一道闸
describe('parseCopilotDecision', () => {
  it('R1: 解析工具调用 JSON（含 thought）', () => {
    const decision = parseCopilotDecision(
      '{"tool":"list_orders","args":{"status":"paid","limit":5},"thought":"查看待发货"}',
    );
    expect(decision).toEqual({
      type: 'tool',
      tool: 'list_orders',
      args: { status: 'paid', limit: 5 },
      thought: '查看待发货',
    });
  });

  it('R1: 剥离 markdown 代码围栏', () => {
    const decision = parseCopilotDecision('```json\n{"final":"你好"}\n```');
    expect(decision).toEqual({ type: 'final', reply: '你好' });
  });

  it('R1: JSON 前后有解释文字时仍能提取对象', () => {
    const decision = parseCopilotDecision('好的，我先查询。\n{"tool":"get_store_overview","args":{}}');
    expect(decision.type).toBe('tool');
  });

  it('R1: 纯文本回复降级为 final，不臆造工具', () => {
    const decision = parseCopilotDecision('当前没有待审批退款。');
    expect(decision).toEqual({ type: 'final', reply: '当前没有待审批退款。' });
  });

  it('R2: 空返回标记为 invalid', () => {
    expect(parseCopilotDecision('   ').type).toBe('invalid');
  });

  it('R2: 工具名缺失但给了 final 时按 final 处理', () => {
    const decision = parseCopilotDecision('{"args":{},"final":"需要更多信息"}');
    expect(decision).toEqual({ type: 'final', reply: '需要更多信息' });
  });
});

describe('validateToolArgs', () => {
  const updateOrder = getTool('update_order_status');
  const createCoupon = getTool('create_coupon');

  it('R2: 合法参数通过并裁剪字符串', () => {
    const result = validateToolArgs(updateOrder!, {
      orderNo: ' ORD20261021ABC123 ',
      status: 'shipped',
      carrier: 'DHL',
    });
    expect(result.ok).toBe(true);
    expect(result.args.orderNo).toBe('ORD20261021ABC123');
    expect(result.args.carrier).toBe('DHL');
  });

  it('R2: 缺少必填参数被拒绝', () => {
    const result = validateToolArgs(updateOrder!, { status: 'shipped' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('缺少必填参数 "orderNo"');
  });

  it('R2: 枚举外取值被拒绝', () => {
    const result = validateToolArgs(updateOrder!, {
      orderNo: 'ORD20261021ABC123',
      status: 'teleported',
    });
    expect(result.ok).toBe(false);
  });

  it('R2: 未知参数被拒绝（防参数注入）', () => {
    const result = validateToolArgs(updateOrder!, {
      orderNo: 'ORD20261021ABC123',
      status: 'shipped',
      sellerId: 'forged',
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('未知参数 "sellerId"');
  });

  it('R2: 数字越界与类型错误被拒绝', () => {
    const tooMany = validateToolArgs(createCoupon!, {
      code: 'SAVE10',
      type: 'percent',
      value: 10,
      totalQuantity: 999999,
    });
    expect(tooMany.ok).toBe(false);

    const wrongType = validateToolArgs(createCoupon!, {
      code: 'SAVE10',
      type: 'percent',
      value: '10',
    });
    expect(wrongType.ok).toBe(false);
  });

  it('R2: 优惠码格式不符合规则被拒绝', () => {
    const result = validateToolArgs(createCoupon!, {
      code: 'no spaces allowed',
      type: 'percent',
      value: 10,
    });
    expect(result.ok).toBe(false);
  });
});

describe('tool registry', () => {
  it('R2: 只有白名单内的写工具可通过 isWritableTool', () => {
    expect(isWritableTool('update_order_status')).toBe(true);
    expect(isWritableTool('create_coupon')).toBe(true);
    expect(isWritableTool('get_store_overview')).toBe(false);
    expect(isWritableTool('drop_database')).toBe(false);
  });

  it('R2: 工具名唯一', () => {
    const names = COPILOT_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('R2: 工具目录包含每个工具与参数（模型可见性与注册表同源）', () => {
    const catalog = buildToolCatalog(COPILOT_TOOLS);
    for (const tool of COPILOT_TOOLS) {
      expect(catalog).toContain(tool.name);
    }
    expect(catalog).toContain('写操作需人工批准');
  });
});

describe('toChatHistory', () => {
  it('R1: 工具消息折叠为带前缀的 user 消息，保持顺序', () => {
    const history = toChatHistory([
      { role: 'user', content: '看看订单', toolName: null },
      { role: 'tool', content: '共 3 条订单', toolName: 'list_orders' },
      { role: 'assistant', content: '已查到', toolName: null },
    ]);
    expect(history).toEqual([
      { role: 'user', content: '看看订单' },
      { role: 'user', content: '[工具 list_orders 的执行结果]\n共 3 条订单' },
      { role: 'assistant', content: '已查到' },
    ]);
  });
});
