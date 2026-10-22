import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { CopilotToolDefinition } from '../copilot/copilot-protocol';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { categories, productVariants, products } from '../../database/schema';
import { CartService } from '../cart/cart.service';
import { CategoriesService } from '../categories/categories.service';

export interface ShopperToolResult {
  ok: boolean;
  content: string;
  /** 检索类工具的结果条数（供转化漏斗区分"有结果"与"零结果"） */
  resultCount?: number;
  /** 检索类工具命中的商品 ID（供商品级漏斗记录"被推荐"） */
  productIds?: string[];
}

/**
 * 买家导购工具执行器：只读查询 + 加购。
 * 加购复用 CartService，库存校验、匿名会话合并等逻辑与手动加购完全一致。
 */
@Injectable()
export class ShopperToolService {
  private readonly logger = new Logger(ShopperToolService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly cartService: CartService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async runReadTool(
    tool: CopilotToolDefinition,
    args: Record<string, unknown>,
    ctx: { userId?: string; sessionId?: string },
  ): Promise<ShopperToolResult> {
    try {
      switch (tool.name) {
        case 'search_products':
          return await this.searchProducts(args);
        case 'list_categories':
          return await this.listCategories();
        case 'get_product_detail':
          return await this.getProductDetail(args);
        case 'get_my_cart':
          return await this.getMyCart(ctx);
        default:
          return { ok: false, content: `未知工具：${tool.name}` };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`导购读取工具 ${tool.name} 失败：${message}`);
      return { ok: false, content: `查询失败：${message}` };
    }
  }

  async runWriteTool(
    tool: CopilotToolDefinition,
    args: Record<string, unknown>,
    ctx: { userId?: string; sessionId?: string },
  ): Promise<ShopperToolResult> {
    if (tool.name === 'add_to_cart') {
      const cart = await this.cartService.addItem(
        ctx.userId,
        ctx.sessionId,
        String(args.productId),
        Number(args.quantity),
      );
      return {
        ok: true,
        content: `已加入购物车，当前共 ${cart.itemCount} 件，合计 $${cart.total}。`,
      };
    }
    return { ok: false, content: `未知写操作：${tool.name}` };
  }

  private async searchProducts(args: Record<string, unknown>): Promise<ShopperToolResult> {
    const keyword = String(args.keyword ?? '').trim();
    const limit = typeof args.limit === 'number' ? args.limit : 5;
    if (!keyword) return { ok: false, content: '请提供搜索关键词。' };

    const escaped = keyword.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const rows = await this.db
      .select({
        id: products.id,
        titleZh: products.titleZh,
        titleEn: products.titleEn,
        descZh: products.descZh,
        categoryId: products.categoryId,
        avgRating: products.avgRating,
        reviewCount: products.reviewCount,
        totalStock: products.totalStock,
        totalSold: products.totalSold,
      })
      .from(products)
      .where(and(
        eq(products.status, 'active'),
        or(
          ilike(products.titleZh, `%${escaped}%`),
          ilike(products.titleEn, `%${escaped}%`),
          ilike(products.descZh, `%${escaped}%`),
          ilike(products.descEn, `%${escaped}%`),
        ),
      ))
      .orderBy(desc(products.totalSold), desc(products.createdAt))
      .limit(limit);

    if (rows.length === 0) {
      return { ok: true, content: `没有找到与"${keyword}"相关的在售商品。`, resultCount: 0 };
    }

    const prices = await this.priceRangeFor(rows.map((row) => row.id));
    const lines = rows.map((row) => {
      const range = prices.get(row.id);
      const stockText = row.totalStock > 0 ? `有货（${row.totalStock} 件）` : '缺货';
      const rating = Number(row.avgRating) > 0
        ? `评分 ${Number(row.avgRating).toFixed(1)}（${row.reviewCount} 条）`
        : '暂无评分';
      return `- ${row.titleZh || row.titleEn}｜${range ?? '价格见详情'}｜${stockText}｜${rating}｜id=${row.id}`;
    });
    return {
      ok: true,
      content: `找到 ${rows.length} 个商品：\n${lines.join('\n')}`,
      resultCount: rows.length,
    };
  }

  private async listCategories(): Promise<ShopperToolResult> {
    const rows = await this.categoriesService.findAll();
    if (rows.length === 0) return { ok: true, content: '当前没有分类。' };
    return {
      ok: true,
      content: `共有 ${rows.length} 个分类：\n${rows.map((row) => `- ${row.nameZh} / ${row.nameEn}`).join('\n')}`,
    };
  }

  private async getProductDetail(args: Record<string, unknown>): Promise<ShopperToolResult> {
    const productId = String(args.productId ?? '');
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (rows.length === 0) throw new NotFoundException('商品不存在');
    const product = rows[0];
    if (product.status !== 'active') return { ok: false, content: '该商品已下架。' };

    const variants = await this.db
      .select({
        sku: productVariants.sku,
        optionValues: productVariants.optionValues,
        price: productVariants.price,
        stock: productVariants.stock,
      })
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), eq(productVariants.status, 'active')));

    const variantText = variants.length === 0
      ? '暂无规格信息'
      : variants
        .map((variant) => {
          const options = (variant.optionValues ?? []).join(' / ') || '默认规格';
          const stockText = variant.stock > 0 ? `库存 ${variant.stock}` : '缺货';
          return `  · ${options}｜$${variant.price}｜${stockText}`;
        })
        .join('\n');

    const bulletPoints = (product.bulletPointsZh.length > 0 ? product.bulletPointsZh : product.bulletPointsEn)
      .slice(0, 6)
      .map((point) => `  · ${point}`)
      .join('\n');

    return {
      ok: true,
      productIds: [product.id],
      content: [
        `商品：${product.titleZh || product.titleEn}`,
        `描述：${(product.descZh || product.descEn || '暂无').slice(0, 300)}`,
        bulletPoints ? `卖点：\n${bulletPoints}` : '',
        `规格：\n${variantText}`,
        `总库存：${product.totalStock}｜已售：${product.totalSold}`,
        `评分：${Number(product.avgRating) > 0 ? Number(product.avgRating).toFixed(1) : '暂无'}`,
        `id=${product.id}`,
      ].filter(Boolean).join('\n'),
    };
  }

  private async getMyCart(ctx: { userId?: string; sessionId?: string }): Promise<ShopperToolResult> {
    const cart = await this.cartService.getCart(ctx.userId, ctx.sessionId);
    if (cart.items.length === 0) return { ok: true, content: '购物车是空的。' };
    const lines = cart.items.map(
      (item) =>
        `- ${item.product.titleZh || item.product.titleEn}｜$${item.product.minPrice ?? '0'} × ${item.quantity}`,
    );
    return {
      ok: true,
      content: `购物车共 ${cart.itemCount} 件，合计 $${cart.total}：\n${lines.join('\n')}`,
    };
  }

  private async priceRangeFor(productIds: string[]): Promise<Map<string, string>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        productId: productVariants.productId,
        minPrice: sql<string>`MIN(${productVariants.price})::text`,
        maxPrice: sql<string>`MAX(${productVariants.price})::text`,
      })
      .from(productVariants)
      .where(and(eq(productVariants.status, 'active'), inArray(productVariants.productId, productIds)))
      .groupBy(productVariants.productId);

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(
        row.productId,
        row.minPrice === row.maxPrice ? `$${row.minPrice}` : `$${row.minPrice} - $${row.maxPrice}`,
      );
    }
    return map;
  }
}
