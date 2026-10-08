import { Inject, Injectable } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { AiGatewayService } from './ai-gateway.service';
import { products, categories } from '@server/database/schema';
import type { AISelectResponse } from '@shared/api.interface';

@Injectable()
export class SelectService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async selectProducts(userId?: string): Promise<AISelectResponse> {
    const allCategories = await this.db.select({
      id: categories.id,
      nameZh: categories.nameZh,
      nameEn: categories.nameEn,
    }).from(categories);

    const topProducts = await this.db
      .select({
        id: products.id,
        titleEn: products.titleEn,
        categoryId: products.categoryId,
        sold: products.sold,
        price: products.price,
        stock: products.stock,
      })
      .from(products)
      .where(eq(products.status, 'active'))
      .orderBy(desc(products.sold))
      .limit(20);

    const stockLevels = topProducts.map((p) => ({
      titleEn: p.titleEn,
      stock: p.stock,
      price: String(p.price),
    }));

    const dataContext = JSON.stringify({
      categories: allCategories,
      topProducts: stockLevels,
    }, null, 2);

    const systemPrompt = '你是专业的跨境电商选品专家，擅长基于销售数据和市场趋势给出选品建议。请用中文输出严格的 JSON 格式。';

    const userPrompt = `基于以下店铺现有类目和销售数据，推荐 5-8 个值得上架的细分品。

## 现有数据
${dataContext}

## 输出格式要求
请返回严格的 JSON 格式，结构如下：
{
  "items": [
    {
      "keyword": "细分品关键词",
      "estimatedDemand": "预估市场需求描述（如\"高\"、\"中\"、\"低\"）",
      "suggestedPriceRange": "建议售价区间（如 \"$19.99 - $29.99\"）",
      "reason": "推荐理由（2-3句话）",
      "confidence": 0.85
    }
  ]
}

confidence 是 0-1 之间的数字，表示推荐置信度。
每个细分品应有差异化定位，避免同质化推荐。`;

    const { content } = await this.aiGateway.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.8, maxTokens: 2000, responseFormat: 'json', agent: 'select', userId },
    );

    const parsed = JSON.parse(content) as AISelectResponse;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  }
}
