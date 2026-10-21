import type { CopilotToolDefinition } from '../copilot/copilot-protocol';

/**
 * 买家端导购工具（只读 + 加购）。
 * 与卖家副驾共用协议与网关，但工具集按角色隔离：
 * 买家永远看不到订单管理 / 退款审批 / 发券 / 改价等卖家工具。
 */
export const SHOPPER_TOOLS: readonly CopilotToolDefinition[] = [
  {
    name: 'search_products',
    description: '按关键词搜索在售商品，返回标题、价格区间、评分、库存状态',
    kind: 'read',
    params: [
      {
        name: 'keyword',
        type: 'string',
        description: '搜索关键词（中英文均可）',
        required: true,
        maxLength: 100,
      },
      {
        name: 'limit',
        type: 'number',
        description: '返回条数（1-10，默认 5）',
        integer: true,
        min: 1,
        max: 10,
      },
    ],
  },
  {
    name: 'list_categories',
    description: '列出全部商品分类，用于回答"你们卖什么"类问题',
    kind: 'read',
    params: [],
  },
  {
    name: 'get_product_detail',
    description: '读取单个商品详情：描述、卖点、规格、价格、库存、评分',
    kind: 'read',
    params: [
      {
        name: 'productId',
        type: 'string',
        description: '商品 ID（UUID，可从搜索结果获得）',
        required: true,
        maxLength: 36,
        pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      },
    ],
  },
  {
    name: 'get_my_cart',
    description: '读取当前买家购物车内容与合计金额',
    kind: 'read',
    params: [],
  },
  {
    name: 'add_to_cart',
    description: '把商品加入当前买家购物车（买家确认后执行）',
    kind: 'write',
    params: [
      {
        name: 'productId',
        type: 'string',
        description: '商品 ID（UUID）',
        required: true,
        maxLength: 36,
        pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      },
      {
        name: 'quantity',
        type: 'number',
        description: '数量（1-20）',
        required: true,
        integer: true,
        min: 1,
        max: 20,
      },
    ],
    summarize: (args) => `把商品加入购物车（数量 ${String(args.quantity)}）`,
  },
] as const;

export function getShopperTool(name: string): CopilotToolDefinition | undefined {
  return SHOPPER_TOOLS.find((tool) => tool.name === name);
}
