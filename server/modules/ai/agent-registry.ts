import type { BuiltinAgentMeta } from '../../../shared/api.interface';

export type { BuiltinAgentMeta };

/**
 * 内置 5 个 Agent（由代码定义，带专属数据管线，UI 中只读展示）。
 * 用户可另建任意数量的自定义 Agent（存 ai_agents 表）。
 */
export const BUILTIN_AGENTS: BuiltinAgentMeta[] = [
  {
    key: 'copywriter',
    name: '商品文案',
    description: '生成标题 / 卖点 / 长描述 / SEO 关键词（强制 JSON 输出，可写回商品多语言字段）',
    usesModel: '对话模型',
  },
  {
    key: 'support',
    name: '智能客服',
    description: '关键词召回 + FAQ 政策 + 订单摘要三层检索，对话会话落库（卖家咨询管理可回看）',
    usesModel: '对话模型',
  },
  {
    key: 'trend',
    name: '趋势分析',
    description: '近 30 天销售 SQL 聚合 + LLM 解读，报告落库、历史可回看',
    usesModel: '推理模型（建议 deepseek-reasoner）',
  },
  {
    key: 'select',
    name: '选品建议',
    description: '类目 + Top 20 热销 + 库存上下文，输出结构化选品推荐',
    usesModel: '对话模型',
  },
  {
    key: 'translation',
    name: '多语言翻译',
    description: '12 种目标语言，跨境电商场景精准翻译',
    usesModel: '对话模型',
  },
];
