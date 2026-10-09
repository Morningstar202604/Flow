import { Inject, Injectable } from '@nestjs/common';
import { eq, desc, ilike, or, and } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { AiGatewayService, type ChatMessage } from './ai-gateway.service';
import { products, inquiryMessages, orders } from '@server/database/schema';
import type { SupportChatRequest, SupportChatResponse } from '@shared/api.interface';

interface FAQEntry {
  keywords: string[];
  question: string;
  answer: string;
}

const SHOP_FAQS: FAQEntry[] = [
  {
    keywords: ['退换', '退货', '退款', 'return', 'refund', 'exchange', '退换货'],
    question: '退换货政策',
    answer: '30天无理由退换，商品需保持全新未使用状态。',
  },
  {
    keywords: ['发货', '物流', '配送', 'shipping', 'delivery', 'dispatch', '多久到'],
    question: '发货时间',
    answer: '订单付款后2-5个工作日内发货。',
  },
  {
    keywords: ['支付', '付款', 'payment', 'paypal', '信用卡', '银行转账'],
    question: '支付方式',
    answer: '支持信用卡、PayPal、银行转账。',
  },
  {
    keywords: ['追踪', '运单号', 'tracking', '物流号', '快递', 'tracking number'],
    question: '物流追踪',
    answer: '发货后会通过邮件发送物流追踪号。',
  },
  {
    keywords: ['客服', '工作时间', '营业时间', 'support', 'service hours', '人工'],
    question: '客服时间',
    answer: '周一至周五 9:00-18:00 GMT+8。',
  },
];

@Injectable()
export class SupportService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async chat(dto: SupportChatRequest, userId?: string): Promise<SupportChatResponse> {
    const messageLower = dto.message.toLowerCase();

    // RAG: 检索相关商品（优先向量检索，失败回退关键词匹配）
    const relatedProducts = await this.searchProducts(dto.message, dto.language);

    // RAG: 匹配店铺政策 FAQ
    const matchedFaqs = this.matchFaqs(messageLower);

    // 查询订单状态（如果有 orderNo）
    let orderInfo = '';
    if (dto.orderNo) {
      orderInfo = await this.getOrderInfo(dto.orderNo);
    }

    // 读取对话历史
    const historyMessages = await this.getHistoryMessages(dto.sessionId);

    // 构建上下文
    const contextParts: string[] = [];

    if (relatedProducts.length > 0) {
      const productsText = relatedProducts
        .map((p, i: number) => `${i + 1}. ${p.titleEn} - ${p.descEn || 'No description'} - Price: $${p.price}`)
        .join('\n');
      contextParts.push(`【相关商品】\n${productsText}`);
    }

    if (matchedFaqs.length > 0) {
      const faqsText = matchedFaqs
        .map((f) => `- ${f.question}: ${f.answer}`)
        .join('\n');
      contextParts.push(`【店铺政策】\n${faqsText}`);
    }

    if (orderInfo) {
      contextParts.push(`【订单信息】\n${orderInfo}`);
    }

    const systemPrompt = this.buildSystemPrompt(dto.language, contextParts.join('\n\n'));

    // 构建消息序列：system + history + current user
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: dto.message },
    ];

    const { content: reply } = await this.aiGateway.chat(messages, {
      temperature: 0.5,
      maxTokens: 800,
      agent: 'support',
      userId,
    });

    // 收集 sources
    const sources: string[] = [];
    if (matchedFaqs.length > 0) {
      sources.push(...matchedFaqs.map((f) => `店铺政策 - ${f.question}`));
    }
    if (relatedProducts.length > 0) {
      sources.push(`相关商品 (${relatedProducts.length}个)`);
    }

    return {
      reply: reply.trim(),
      sources: sources.length > 0 ? sources : undefined,
    };
  }

  private async searchProducts(
    query: string,
    language?: string,
  ): Promise<Array<{ id: string; titleEn: string; descEn: string | null; price: string }>> {
    void language;

    // 关键词匹配检索
    // 判断是否包含商品相关词汇
    const productKeywords = ['product', '商品', '产品', 'item', '商品详情', '规格', 'spec', '多少钱', 'price', '价格'];
    const lowerQuery = query.toLowerCase();
    const isProductRelated = productKeywords.some((kw: string) => lowerQuery.includes(kw.toLowerCase()));

    if (!isProductRelated) {
      return [];
    }

    try {
      const rows = await this.db
        .select({
          id: products.id,
          titleEn: products.titleEn,
          descEn: products.descEn,
          price: products.price,
        })
        .from(products)
        .where(and(
          eq(products.status, 'active'),
          or(
            ilike(products.titleEn, `%${query}%`),
            ilike(products.titleZh, `%${query}%`),
            ilike(products.descEn, `%${query}%`),
          ),
        ))
        .orderBy(desc(products.sold))
        .limit(5);

      return rows.map((row) => ({
        id: row.id,
        titleEn: row.titleEn,
        descEn: row.descEn,
        price: String(row.price),
      }));
    } catch {
      return [];
    }
  }

  private matchFaqs(queryLower: string): FAQEntry[] {
    return SHOP_FAQS.filter((faq: FAQEntry) =>
      faq.keywords.some((kw: string) => queryLower.includes(kw.toLowerCase())),
    );
  }

  private async getOrderInfo(orderNo: string): Promise<string> {
    try {
      const [order] = await this.db
        .select({
          orderNo: orders.orderNo,
          status: orders.status,
          totalAmount: orders.totalAmount,
          trackingNo: orders.trackingNumber,
          createdAt: orders.createdAt,
          shippedAt: orders.shippedAt,
        })
        .from(orders)
        .where(eq(orders.orderNo, orderNo))
        .limit(1);

      if (!order) {
        return `订单号 ${orderNo} 未找到。`;
      }

      const statusMap: Record<string, string> = {
        pending_payment: '待付款',
        paid: '已付款，待发货',
        shipped: '已发货',
        delivered: '已送达',
        cancelled: '已取消',
      };

      return [
        `订单号: ${order.orderNo}`,
        `状态: ${statusMap[order.status] || order.status}`,
        `金额: $${order.totalAmount}`,
          order.trackingNo ? `运单号: ${order.trackingNo}` : '',
        order.shippedAt ? `发货时间: ${order.shippedAt.toISOString()}` : '',
      ].filter(Boolean).join('\n');
    } catch {
      return '';
    }
  }

  private async getHistoryMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const rows = await this.db
        .select({
          role: inquiryMessages.role,
          content: inquiryMessages.content,
        })
        .from(inquiryMessages)
        .where(eq(inquiryMessages.sessionId, sessionId))
        .orderBy(desc(inquiryMessages.createdAt))
        .limit(10);

      // 按时间升序排列，且只保留 user/assistant 角色
      return rows
        .reverse()
        .filter((row) => row.role === 'user' || row.role === 'assistant')
        .map((row) => ({
          role: row.role as 'user' | 'assistant',
          content: row.content,
        }));
    } catch {
      return [];
    }
  }

  private buildSystemPrompt(language: string | undefined, context: string): string {
    const langInstruction = language === 'zh'
      ? '请用中文回复。'
      : language === 'en'
      ? 'Please reply in English.'
      : 'Please reply in the same language as the user\'s message.';

    return `你是专业的跨境电商智能客服，负责回答买家关于商品、订单、物流、售后等问题。${langInstruction}

## 回复规则
1. 基于以下上下文回答问题，不要编造上下文中不存在的信息。
2. 如果上下文中没有相关信息，请礼貌说明"暂无相关信息"或建议联系人工客服。
3. 语气友好、专业、简洁。
4. 不要假装能访问外部系统或实时数据，只能使用提供的上下文。

## 参考上下文
${context || '（暂无额外上下文）'}

请根据以上规则和上下文回答用户问题。`;
  }
}
