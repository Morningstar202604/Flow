import type { CopilotToolDefinition } from './copilot-protocol';
import type { CopilotToolKind, OrderStatus } from '../../../shared/api.interface';

export const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  'pending_payment', 'paid', 'shipped', 'delivered', 'cancelled',
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 副驾可用工具清单（单一事实来源）：
 * - read：直接执行，结果回填给模型
 * - write：绝不在模型循环内执行，先落 copilot_actions(pending)，卖家批准后才走业务服务
 */
export const COPILOT_TOOLS: readonly CopilotToolDefinition[] = [
  {
    name: 'get_store_overview',
    description: '读取店铺经营概况：GMV、订单数、访客数、商品数、今日 GMV/订单、待发货订单数',
    kind: 'read',
    params: [],
  },
  {
    name: 'list_orders',
    description: '按状态查询订单列表（默认最近 10 条），返回订单号、金额、状态、买家、下单时间',
    kind: 'read',
    params: [
      {
        name: 'status',
        type: 'string',
        description: '订单状态过滤',
        enum: ORDER_STATUS_VALUES,
      },
      {
        name: 'keyword',
        type: 'string',
        description: '订单号关键词',
        maxLength: 64,
      },
      {
        name: 'limit',
        type: 'number',
        description: '返回条数（1-20）',
        integer: true,
        min: 1,
        max: 20,
      },
    ],
  },
  {
    name: 'list_products',
    description: '查询商品列表（默认最近 10 条；未指定状态时仅返回在售商品），返回标题、状态、价格、总库存、总销量',
    kind: 'read',
    params: [
      {
        name: 'keyword',
        type: 'string',
        description: '商品标题关键词',
        maxLength: 100,
      },
      {
        name: 'status',
        type: 'string',
        description: '商品状态',
        enum: ['draft', 'active', 'inactive'],
      },
      {
        name: 'limit',
        type: 'number',
        description: '返回条数（1-20）',
        integer: true,
        min: 1,
        max: 20,
      },
    ],
  },
  {
    name: 'list_low_stock',
    description: '查询库存告警：总库存低于阈值的在售商品（按库存升序）',
    kind: 'read',
    params: [
      {
        name: 'threshold',
        type: 'number',
        description: '库存阈值（0-10000，默认 10）',
        integer: true,
        min: 0,
        max: 10000,
      },
    ],
  },
  {
    name: 'list_pending_refunds',
    description: '查询待审批退款，返回退款号、订单号、金额、原因、申请时间',
    kind: 'read',
    params: [],
  },
  {
    name: 'update_order_status',
    description: '变更订单状态（发货/完成/取消/标记已支付）；会走既有订单状态机与库存/积分逻辑',
    kind: 'write',
    params: [
      {
        name: 'orderNo',
        type: 'string',
        description: '订单号（如 ORD20261021XXXXXXXXXX）',
        required: true,
        maxLength: 32,
        pattern: /^[A-Za-z0-9-]{6,32}$/,
      },
      {
        name: 'status',
        type: 'string',
        description: '目标状态',
        required: true,
        enum: ORDER_STATUS_VALUES,
      },
      {
        name: 'carrier',
        type: 'string',
        description: '物流商（发货时可选）',
        maxLength: 50,
      },
      {
        name: 'trackingNumber',
        type: 'string',
        description: '运单号（发货时可选）',
        maxLength: 64,
      },
    ],
    summarize: (args) =>
      `把订单 ${String(args.orderNo)} 状态改为 ${String(args.status)}` +
      (args.trackingNumber ? `（${String(args.carrier ?? '物流')}：${String(args.trackingNumber)}）` : ''),
  },
  {
    name: 'approve_refund',
    description: '批准退款（原路退回 + 库存/销量/积分回补）；不可撤销，必须卖家确认',
    kind: 'write',
    params: [
      {
        name: 'refundNo',
        type: 'string',
        description: '退款单号（如 RF...）',
        required: true,
        maxLength: 32,
        pattern: /^[A-Za-z0-9-]{6,32}$/,
      },
      {
        name: 'reply',
        type: 'string',
        description: '给买家的回复（可选）',
        maxLength: 500,
      },
    ],
    summarize: (args) => `批准退款单 ${String(args.refundNo)}`,
  },
  {
    name: 'reject_refund',
    description: '拒绝退款申请，必须填写拒绝原因',
    kind: 'write',
    params: [
      {
        name: 'refundNo',
        type: 'string',
        description: '退款单号（如 RF...）',
        required: true,
        maxLength: 32,
        pattern: /^[A-Za-z0-9-]{6,32}$/,
      },
      {
        name: 'reply',
        type: 'string',
        description: '拒绝原因（会展示给买家）',
        required: true,
        maxLength: 500,
      },
    ],
    summarize: (args) => `拒绝退款单 ${String(args.refundNo)}：${String(args.reply)}`,
  },
  {
    name: 'update_product_status',
    description: '上架 / 下架 / 转草稿商品',
    kind: 'write',
    params: [
      {
        name: 'productId',
        type: 'string',
        description: '商品 ID（UUID）',
        required: true,
        maxLength: 36,
        pattern: UUID_PATTERN,
      },
      {
        name: 'status',
        type: 'string',
        description: '目标状态',
        required: true,
        enum: ['draft', 'active', 'inactive'],
      },
    ],
    summarize: (args) => `把商品 ${String(args.productId).slice(0, 8)}… 状态改为 ${String(args.status)}`,
  },
  {
    name: 'create_coupon',
    description: '创建优惠券（百分比 / 固定金额 / 包邮）',
    kind: 'write',
    params: [
      {
        name: 'code',
        type: 'string',
        description: '优惠码（字母数字，3-30 位）',
        required: true,
        maxLength: 30,
        pattern: /^[A-Za-z0-9_-]{3,30}$/,
      },
      {
        name: 'type',
        type: 'string',
        description: '券类型',
        required: true,
        enum: ['percent', 'fixed', 'free_shipping'],
      },
      {
        name: 'value',
        type: 'number',
        description: '面额（percent 为 1-100；fixed 为金额；free_shipping 忽略）',
        min: 0,
        max: 100000,
      },
      {
        name: 'minOrderAmount',
        type: 'number',
        description: '最低消费门槛（默认 0）',
        min: 0,
        max: 1000000,
      },
      {
        name: 'totalQuantity',
        type: 'number',
        description: '发放总量（1-100000，默认 100）',
        integer: true,
        min: 1,
        max: 100000,
      },
      {
        name: 'expiresInDays',
        type: 'number',
        description: '有效天数（1-365，默认 30）',
        integer: true,
        min: 1,
        max: 365,
      },
    ],
    summarize: (args) => {
      const type = String(args.type);
      const label = type === 'percent'
        ? `${String(args.value ?? '')}% 折扣`
        : type === 'fixed'
          ? `立减 ${String(args.value ?? '')}`
          : '包邮';
      return `创建优惠券 ${String(args.code)}（${label}）`;
    },
  },
  {
    name: 'create_draft_product',
    description: '创建一个草稿商品（仅卖家确认后执行；默认 draft 状态，不会直接上架）。用于把买家未满足需求转成待完善的上架草稿',
    kind: 'write',
    params: [
      {
        name: 'titleZh',
        type: 'string',
        description: '中文商品标题',
        required: true,
        maxLength: 200,
      },
      {
        name: 'titleEn',
        type: 'string',
        description: '英文商品标题',
        required: true,
        maxLength: 200,
      },
      {
        name: 'descZh',
        type: 'string',
        description: '中文卖点描述（可选）',
        maxLength: 1000,
      },
      {
        name: 'price',
        type: 'number',
        description: '建议售价（0.01-1000000）',
        required: true,
        min: 0.01,
        max: 1000000,
      },
      {
        name: 'stock',
        type: 'number',
        description: '初始库存（0-100000，默认 0，草稿阶段通常为 0）',
        integer: true,
        min: 0,
        max: 100000,
      },
      {
        name: 'categoryId',
        type: 'string',
        description: '分类 ID（可选；不确定时留空）',
        maxLength: 36,
        pattern: UUID_PATTERN,
      },
    ],
    summarize: (args) =>
      `创建草稿商品《${String(args.titleZh)}》，建议售价 $${String(args.price)}`,
  },
  {
    name: 'send_inquiry_reply',
    description: '以卖家身份回复买家咨询会话',
    kind: 'write',
    params: [
      {
        name: 'sessionId',
        type: 'string',
        description: '咨询会话 ID',
        required: true,
        maxLength: 64,
        pattern: /^[\w-]{8,64}$/,
      },
      {
        name: 'content',
        type: 'string',
        description: '回复内容',
        required: true,
        maxLength: 2000,
      },
    ],
    summarize: (args) => `回复咨询会话 ${String(args.sessionId)}`,
  },
] as const;

export function getTool(name: string): CopilotToolDefinition | undefined {
  return COPILOT_TOOLS.find((tool) => tool.name === name);
}

/**
 * 写操作在白名单内才允许落库为待审批动作。
 * 未注册的工具名（模型幻觉）一律拒绝，避免任意函数被调用。
 */
export function isWritableTool(name: string): boolean {
  const tool = getTool(name);
  return tool?.kind === 'write';
}

export function toolKind(name: string): CopilotToolKind | null {
  return getTool(name)?.kind ?? null;
}
