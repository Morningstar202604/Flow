import { Injectable, Inject, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { products, categories, productVariants, reviews, stockMovements } from '../../database/schema';
import { eq, and, count, desc, asc, ilike, sql, inArray, type SQL } from 'drizzle-orm';
import type {
  Product,
  ProductListResponse,
  ProductListParams,
  CreateProductRequest,
  UpdateProductRequest,
} from '../../../shared/api.interface';
import { AuditService } from '../audit/audit.service';
import Papa from 'papaparse';

export interface ImportFailure { row: number; reason: string; }
export interface ImportResult { successCount: number; failCount: number; failures: ImportFailure[]; }

interface ParsedCsvRow {
  nameZh: string; nameEn: string; category: string; price: string;
  stock: string; descriptionZh: string; descriptionEn: string; images: string;
}

export interface ProductVariant {
  id: string; productId: string; sku: string; optionValues: string[];
  price: string; originalPrice?: string; stock: number; sold: number;
  image?: string; status: string;
}

export interface CreateVariantDto {
  sku: string; optionValues?: string[]; price: number; originalPrice?: number;
  stock?: number; sold?: number; image?: string; status?: 'draft' | 'active' | 'inactive';
}

export interface UpdateVariantDto {
  sku?: string; optionValues?: string[]; price?: number; originalPrice?: number;
  stock?: number; sold?: number; image?: string; status?: 'draft' | 'active' | 'inactive';
}

export interface StockChangeParams {
  variantId: string; delta: number;
  reason: 'sale' | 'purchase' | 'refund_return' | 'adjustment';
  referenceId?: string; note?: string; createdBy?: string;
}

type ProductWithCategory = typeof products.$inferSelect & {
  categoryNameZh: string | null; categoryNameEn: string | null;
  avgRating: number | null; reviewCount: number | null;
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  // ── DTO helpers ──────────────────────────────

  private variantToDto(v: typeof productVariants.$inferSelect): ProductVariant {
    return {
      id: v.id, productId: v.productId, sku: v.sku,
      optionValues: v.optionValues ?? [],
      price: String(v.price),
      originalPrice: v.originalPrice != null ? String(v.originalPrice) : undefined,
      stock: v.stock, sold: v.sold, image: v.image ?? undefined, status: v.status,
    };
  }

  private async toDto(row: ProductWithCategory): Promise<Product> {
    const variants = await this.listVariants(row.id);
    const activeVariants = variants.filter((v) => v.status === 'active');
    const prices = activeVariants.map((v) => Number(v.price));
    const minPrice = prices.length > 0 ? Math.min(...prices).toString() : '0';
    return {
      id: row.id,
      titleZh: row.titleZh, titleEn: row.titleEn,
      descZh: row.descZh ?? '', descEn: row.descEn ?? '',
      longDescZh: row.longDescZh ?? '', longDescEn: row.longDescEn ?? '',
      categoryId: row.categoryId ?? undefined,
      categoryNameZh: row.categoryNameZh ?? undefined, categoryNameEn: row.categoryNameEn ?? undefined,
      sellerId: row.sellerId, minPrice, maxPrice: activeVariants[0]?.originalPrice ?? minPrice,
      totalStock: row.totalStock, totalSold: row.totalSold,
      status: row.status as 'draft' | 'active' | 'inactive',
      coverImage: row.coverImage ?? undefined, images: row.images ?? [],
      optionNames: row.optionNames ?? [], seoKeywordsZh: row.seoKeywordsZh ?? '', seoKeywordsEn: row.seoKeywordsEn ?? '',
      bulletPointsZh: row.bulletPointsZh ?? [], bulletPointsEn: row.bulletPointsEn ?? [],
      weight: row.weight ? String(row.weight) : undefined,
      avgRating: row.avgRating != null ? Number(row.avgRating) : undefined,
      reviewCount: row.reviewCount != null ? Number(row.reviewCount) : undefined,
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
      variants,
    };
  }

  // ── Query helpers ────────────────────────────

  private buildWhere(params: ProductListParams) {
    const conditions: SQL[] = [];
    if (params.status !== undefined) {
      conditions.push(eq(products.status, params.status));
    } else {
      conditions.push(eq(products.status, 'active'));
    }
    if (params.categoryId) conditions.push(eq(products.categoryId, params.categoryId));
    if (params.keyword) {
      const escaped = params.keyword.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push(sql`(${ilike(products.titleZh, `%${escaped}%`)} OR ${ilike(products.titleEn, `%${escaped}%`)})`);
    }
    return conditions;
  }

  private getOrderBy(sortBy: ProductListParams['sortBy']) {
    switch (sortBy) {
      case 'sold_desc': return [desc(products.totalSold)];
      case 'newest': default: return [desc(products.createdAt)];
    }
  }

  // ── Variant query ────────────────────────────

  private async fetchVariantsForProducts(productIds: string[]): Promise<Map<string, ProductVariant[]>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.db.select().from(productVariants)
      .where(inArray(productVariants.productId, productIds))
      .orderBy(asc(productVariants.createdAt));
    const map = new Map<string, ProductVariant[]>();
    for (const v of rows) {
      const list = map.get(v.productId) ?? [];
      list.push(this.variantToDto(v));
      map.set(v.productId, list);
    }
    return map;
  }

  // ── List products ────────────────────────────

  async findAll(params: ProductListParams): Promise<ProductListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const conditions = this.buildWhere(params);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const orderBy = this.getOrderBy(params.sortBy);

    const baseQuery = this.db.select({
      ...(products as any),
      categoryNameZh: categories.nameZh,
      categoryNameEn: categories.nameEn,
    }).from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(whereClause)
      .orderBy(...orderBy, desc(products.id));

    const [countResult, rows] = await Promise.all([
      this.db.select({ count: count() }).from(products).where(whereClause),
      baseQuery.limit(pageSize).offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const productRows = rows as unknown as ProductWithCategory[];
    const variantsMap = await this.fetchVariantsForProducts(productRows.map((r: any) => r.id));

    const items = productRows.map((row) => {
      const variants = variantsMap.get(row.id) ?? [];
      const activeVariants = variants.filter((v) => v.status === 'active');
      const prices = activeVariants.map((v) => Number(v.price));
      const minPrice = prices.length > 0 ? Math.min(...prices).toString() : '0';
      return {
        id: row.id,
        titleZh: row.titleZh, titleEn: row.titleEn,
        descZh: row.descZh ?? '', descEn: row.descEn ?? '',
        longDescZh: row.longDescZh ?? '', longDescEn: row.longDescEn ?? '',
        categoryId: row.categoryId ?? undefined,
        categoryNameZh: row.categoryNameZh ?? undefined, categoryNameEn: row.categoryNameEn ?? undefined,
        sellerId: row.sellerId, minPrice, maxPrice: activeVariants[0]?.originalPrice ?? minPrice,
        totalStock: row.totalStock, totalSold: row.totalSold,
        status: row.status as 'draft' | 'active' | 'inactive',
        coverImage: row.coverImage ?? undefined, images: row.images ?? [],
        optionNames: row.optionNames ?? [], seoKeywordsZh: row.seoKeywordsZh ?? '', seoKeywordsEn: row.seoKeywordsEn ?? '',
        bulletPointsZh: row.bulletPointsZh ?? [], bulletPointsEn: row.bulletPointsEn ?? [],
        weight: row.weight ? String(row.weight) : undefined,
        avgRating: row.avgRating != null ? Number(row.avgRating) : undefined,
        reviewCount: row.reviewCount != null ? Number(row.reviewCount) : undefined,
        createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
        variants,
      };
    });

    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<Product> {
    const rows = await this.db.select({
      ...(products as any),
      categoryNameZh: categories.nameZh,
      categoryNameEn: categories.nameEn,
    }).from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id)).limit(1);

    if (rows.length === 0) throw new NotFoundException('商品不存在');

    const result = await this.toDto(rows[0] as unknown as ProductWithCategory);

    const reviewStats = await this.db.select({
      avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 1)`,
      reviewCount: count(reviews.id),
    }).from(reviews).where(eq(reviews.productId, id));

    if (reviewStats.length > 0) {
      result.avgRating = reviewStats[0].avgRating != null ? Number(reviewStats[0].avgRating) : 0;
      result.reviewCount = Number(reviewStats[0].reviewCount);
    } else {
      result.avgRating = 0;
      result.reviewCount = 0;
    }
    return result;
  }

  /**
   * 按 ID 列表批量返回完整商品（保持传入顺序；一次查询商品 + 一次查询变体）。
   * 供店铺楼层等聚合场景复用，避免逐个 findOne 造成 N+1。
   */
  async findByIds(ids: string[], onlyActive = true): Promise<Product[]> {
    if (ids.length === 0) return [];

    const rows = await this.db.select({
      ...(products as any),
      categoryNameZh: categories.nameZh,
      categoryNameEn: categories.nameEn,
    }).from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(inArray(products.id, ids));

    const productRows = (rows as unknown as ProductWithCategory[])
      .filter((row) => !onlyActive || row.status === 'active');
    const variantsMap = await this.fetchVariantsForProducts(productRows.map((row) => row.id));

    const byId = new Map(productRows.map((row) => [row.id, row]));
    const ordered = ids.map((id) => byId.get(id)).filter((row): row is ProductWithCategory => Boolean(row));

    return ordered.map((row) => {
      const variants = variantsMap.get(row.id) ?? [];
      const activeVariants = variants.filter((v) => v.status === 'active');
      const prices = activeVariants.map((v) => Number(v.price));
      const minPrice = prices.length > 0 ? Math.min(...prices).toString() : '0';
      return {
        id: row.id,
        titleZh: row.titleZh, titleEn: row.titleEn,
        descZh: row.descZh ?? '', descEn: row.descEn ?? '',
        longDescZh: row.longDescZh ?? '', longDescEn: row.longDescEn ?? '',
        categoryId: row.categoryId ?? undefined,
        categoryNameZh: row.categoryNameZh ?? undefined, categoryNameEn: row.categoryNameEn ?? undefined,
        sellerId: row.sellerId, minPrice, maxPrice: activeVariants[0]?.originalPrice ?? minPrice,
        totalStock: row.totalStock, totalSold: row.totalSold,
        status: row.status as 'draft' | 'active' | 'inactive',
        coverImage: row.coverImage ?? undefined, images: row.images ?? [],
        optionNames: row.optionNames ?? [], seoKeywordsZh: row.seoKeywordsZh ?? '', seoKeywordsEn: row.seoKeywordsEn ?? '',
        bulletPointsZh: row.bulletPointsZh ?? [], bulletPointsEn: row.bulletPointsEn ?? [],
        weight: row.weight ? String(row.weight) : undefined,
        avgRating: row.avgRating != null ? Number(row.avgRating) : 0,
        reviewCount: row.reviewCount != null ? Number(row.reviewCount) : 0,
        createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
        variants,
      };
    });
  }

  async getFeatured(): Promise<Array<Product>> {
    const rows = await this.db.select({
      ...(products as any),
      categoryNameZh: categories.nameZh,
      categoryNameEn: categories.nameEn,
    }).from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.status, 'active'))
      .orderBy(desc(products.totalSold), desc(products.createdAt)).limit(8);

    const productRows = rows as unknown as ProductWithCategory[];
    const variantsMap = await this.fetchVariantsForProducts(productRows.map((r: any) => r.id));

    return productRows.map((row) => {
      const variants = variantsMap.get(row.id) ?? [];
      const activeVariants = variants.filter((v) => v.status === 'active');
      const prices = activeVariants.map((v) => Number(v.price));
      const minPrice = prices.length > 0 ? Math.min(...prices).toString() : '0';
      return {
        id: row.id,
        titleZh: row.titleZh, titleEn: row.titleEn,
        descZh: row.descZh ?? '', descEn: row.descEn ?? '',
        longDescZh: row.longDescZh ?? '', longDescEn: row.longDescEn ?? '',
        categoryId: row.categoryId ?? undefined,
        categoryNameZh: row.categoryNameZh ?? undefined, categoryNameEn: row.categoryNameEn ?? undefined,
        sellerId: row.sellerId, minPrice, maxPrice: activeVariants[0]?.originalPrice ?? minPrice,
        totalStock: row.totalStock, totalSold: row.totalSold,
        status: row.status as 'draft' | 'active' | 'inactive',
        coverImage: row.coverImage ?? undefined, images: row.images ?? [],
        optionNames: row.optionNames ?? [], seoKeywordsZh: row.seoKeywordsZh ?? '', seoKeywordsEn: row.seoKeywordsEn ?? '',
        bulletPointsZh: row.bulletPointsZh ?? [], bulletPointsEn: row.bulletPointsEn ?? [],
        weight: row.weight ? String(row.weight) : undefined,
        avgRating: row.avgRating != null ? Number(row.avgRating) : 0,
        reviewCount: row.reviewCount != null ? Number(row.reviewCount) : 0,
                createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
        variants,
      };
    });
  }

  // ── Create product ───────────────────────────

  async create(
    input: CreateProductRequest & { variants?: CreateVariantDto[] },
    userId: string,
  ): Promise<Product> {
    try {
      this.validateProductImages(input.coverImage, input.images);
      const result = await this.db.transaction(async (tx) => {
        const [productRow] = await tx.insert(products).values({
          sellerId: userId,
          titleZh: input.titleZh,
          titleEn: input.titleEn,
          descZh: input.descZh ?? undefined,
          descEn: input.descEn ?? undefined,
          longDescZh: input.longDescZh ?? undefined,
          longDescEn: input.longDescEn ?? undefined,
          categoryId: input.categoryId ?? null,
          status: input.status ?? 'draft',
          coverImage: input.coverImage ?? undefined,
          images: input.images ?? [],
          seoKeywordsZh: input.seoKeywordsZh ?? undefined,
          seoKeywordsEn: input.seoKeywordsEn ?? undefined,
          bulletPointsZh: input.bulletPointsZh ?? [],
          bulletPointsEn: input.bulletPointsEn ?? [],
          weight: input.weight !== undefined ? String(input.weight) : null,
          optionNames: input.variants?.length ? this.deriveOptionNames(input.variants) : [],
          totalStock: 0,
          totalSold: 0,
          updatedBy: userId,
        }).returning();

        if (!productRow) throw new BadRequestException('创建商品失败');

        if (input.variants?.length) {
          const variantRows = await tx.insert(productVariants).values(
            input.variants.map((v) => ({
              productId: productRow.id,
              sku: v.sku,
              optionValues: v.optionValues ?? [],
              price: String(v.price),
              originalPrice: v.originalPrice !== undefined ? String(v.originalPrice) : null,
              stock: v.stock ?? 0,
              sold: v.sold ?? 0,
              image: v.image ?? null,
              status: v.status ?? 'active',
            })),
          ).returning();

          const totalStock = variantRows.reduce((sum, v) => sum + v.stock, 0);
          await tx.update(products).set({ totalStock }).where(eq(products.id, productRow.id));
        } else {
          // 界面创建路径（只填价格/库存，不带变体）：自动生成默认变体，
          // 与 CSV 导入口径一致，确保商品可加购、可下单。
          const defaultSku = input.sku?.trim() || `SKU-${(productRow.id as string).slice(0, 8).toUpperCase()}`;
          const stock = input.stock ?? 0;
          await tx.insert(productVariants).values({
            productId: productRow.id,
            sku: defaultSku,
            optionValues: [],
            price: String(input.price),
            originalPrice: input.originalPrice !== undefined ? String(input.originalPrice) : null,
            stock,
            status: 'active',
          });
          await tx.update(products).set({ totalStock: stock }).where(eq(products.id, productRow.id));
        }

        return productRow;
      });

      return this.findOne(result.id);
    } catch (error) {
      this.logger.error('创建商品失败', error);
      throw error;
    }
  }

  private deriveOptionNames(variants: CreateVariantDto[]): string[] {
    if (!variants[0]?.optionValues?.length) return [];
    return Array.from({ length: variants[0].optionValues.length }, (_, i) => `规格${i + 1}`);
  }

  // ── Update product ───────────────────────────

  async update(
    id: string,
    input: UpdateProductRequest,
    userId: string,
    auditMeta?: { role?: string; ip?: string },
  ): Promise<Product> {
    const existingRows = await this.db.select({ status: products.status }).from(products).where(eq(products.id, id));
    if (existingRows.length === 0) throw new NotFoundException('商品不存在');
    const oldStatus = existingRows[0].status as string;

    if (input.coverImage !== undefined || input.images !== undefined) {
      this.validateProductImages(input.coverImage ?? undefined, input.images ?? undefined);
    }

    const patch: Record<string, unknown> = {};
    if (input.titleZh !== undefined) patch.titleZh = input.titleZh;
    if (input.titleEn !== undefined) patch.titleEn = input.titleEn;
    if (input.descZh !== undefined) patch.descZh = input.descZh;
    if (input.descEn !== undefined) patch.descEn = input.descEn;
    if (input.longDescZh !== undefined) patch.longDescZh = input.longDescZh;
    if (input.longDescEn !== undefined) patch.longDescEn = input.longDescEn;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.status !== undefined) patch.status = input.status;
    if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
    if (input.images !== undefined) patch.images = input.images;
    if (input.seoKeywordsZh !== undefined) patch.seoKeywordsZh = input.seoKeywordsZh;
    if (input.seoKeywordsEn !== undefined) patch.seoKeywordsEn = input.seoKeywordsEn;
    if (input.bulletPointsZh !== undefined) patch.bulletPointsZh = input.bulletPointsZh;
    if (input.bulletPointsEn !== undefined) patch.bulletPointsEn = input.bulletPointsEn;
    if (input.weight !== undefined) patch.weight = String(input.weight);

    // 价格/库存同步（界面编辑路径）：
    // - 无变体 → 用新价格/库存补建默认变体（修复历史商品）
    // - 唯一变体 → 同步该变体并重算聚合库存
    // - 多变体 → 忽略（由变体体系/批量导入管理）
    const priceChanged = input.price !== undefined || input.originalPrice !== undefined || input.stock !== undefined;
    if (priceChanged) {
      const variantRows = await this.db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, id));

      if (variantRows.length === 0 && input.price !== undefined) {
        await this.db.insert(productVariants).values({
          productId: id,
          sku: `SKU-${id.slice(0, 8).toUpperCase()}`,
          optionValues: [],
          price: String(input.price),
          originalPrice: input.originalPrice !== undefined ? String(input.originalPrice) : null,
          stock: input.stock ?? 0,
          status: 'active',
        });
        patch.totalStock = input.stock ?? 0;
      } else if (variantRows.length === 1) {
        const only = variantRows[0];
        const variantPatch: Partial<typeof productVariants.$inferInsert> = { updatedAt: new Date() };
        if (input.price !== undefined) variantPatch.price = String(input.price);
        if (input.originalPrice !== undefined) variantPatch.originalPrice = String(input.originalPrice);
        if (input.stock !== undefined) variantPatch.stock = input.stock;
        await this.db.update(productVariants).set(variantPatch).where(eq(productVariants.id, only.id));
        if (input.stock !== undefined) {
          patch.totalStock = input.stock;
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = new Date();
      patch.updatedBy = userId;
      const updated = await this.db.update(products).set(patch).where(eq(products.id, id)).returning({ id: products.id });
      if (updated.length === 0) throw new NotFoundException('商品不存在');
    }

    const result = await this.findOne(id);

    if (input.status !== undefined && input.status !== oldStatus) {
      try {
        void this.auditService.log({
          action: 'product.toggle_status', entity: 'product', entityId: id,
          before: { oldStatus }, after: { newStatus: input.status },
          userId, role: auditMeta?.role, ip: auditMeta?.ip,
        }).catch(() => {});
      } catch { /* noop */ }
    }

    return result;
  }

  // ── Delete product ───────────────────────────

  async remove(id: string): Promise<{ id: string }> {
    const deleted = await this.db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    if (deleted.length === 0) throw new NotFoundException('商品不存在');
    return { id };
  }

  // ── Variant CRUD ─────────────────────────────

  async createVariant(productId: string, dto: CreateVariantDto): Promise<ProductVariant> {
    const productRows = await this.db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    if (productRows.length === 0) throw new NotFoundException('商品不存在');

    const existingSku = await this.db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.sku, dto.sku)).limit(1);
    if (existingSku.length > 0) throw new BadRequestException(`SKU "${dto.sku}" 已存在`);

    const result = await this.db.transaction(async (tx) => {
      const [variant] = await tx.insert(productVariants).values({
        productId, sku: dto.sku, optionValues: dto.optionValues ?? [],
        price: String(dto.price),
        originalPrice: dto.originalPrice !== undefined ? String(dto.originalPrice) : null,
        stock: dto.stock ?? 0, sold: dto.sold ?? 0, image: dto.image ?? null,
        status: dto.status ?? 'active',
      }).returning();

      await tx.update(products)
        .set({ totalStock: sql`${products.totalStock} + ${dto.stock ?? 0}` })
        .where(eq(products.id, productId));

      return variant;
    });

    return this.variantToDto(result);
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto): Promise<ProductVariant> {
    const existingRows = await this.db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (existingRows.length === 0) throw new NotFoundException('变体不存在');
    const existing = existingRows[0];

    if (dto.sku && dto.sku !== existing.sku) {
      const dup = await this.db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.sku, dto.sku)).limit(1);
      if (dup.length > 0) throw new BadRequestException(`SKU "${dto.sku}" 已存在`);
    }

    const patch: Record<string, unknown> = {};
    if (dto.sku !== undefined) patch.sku = dto.sku;
    if (dto.optionValues !== undefined) patch.optionValues = dto.optionValues;
    if (dto.price !== undefined) patch.price = String(dto.price);
    if (dto.originalPrice !== undefined) patch.originalPrice = String(dto.originalPrice);
    if (dto.stock !== undefined) patch.stock = dto.stock;
    if (dto.sold !== undefined) patch.sold = dto.sold;
    if (dto.image !== undefined) patch.image = dto.image;
    if (dto.status !== undefined) patch.status = dto.status;
    patch.updatedAt = new Date();

    if (dto.stock !== undefined && dto.stock !== existing.stock) {
      const diff = dto.stock - existing.stock;
      await this.db.transaction(async (tx) => {
        await tx.update(productVariants).set(patch).where(eq(productVariants.id, variantId));
        await tx.update(products).set({ totalStock: sql`${products.totalStock} + ${diff}` }).where(eq(products.id, existing.productId));
      });
    } else {
      await this.db.update(productVariants).set(patch).where(eq(productVariants.id, variantId));
    }

    const updated = await this.db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    return this.variantToDto(updated[0]);
  }

  async deleteVariant(variantId: string): Promise<{ id: string }> {
    const existingRows = await this.db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (existingRows.length === 0) throw new NotFoundException('变体不存在');
    const existing = existingRows[0];

    await this.db.transaction(async (tx) => {
      await tx.delete(productVariants).where(eq(productVariants.id, variantId));
      await tx.update(products)
        .set({ totalStock: sql`${products.totalStock} - ${existing.stock}` })
        .where(eq(products.id, existing.productId));
    });

    return { id: variantId };
  }

  async listVariants(productId: string): Promise<ProductVariant[]> {
    const variantRows = await this.db.select().from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(asc(productVariants.createdAt));
    return variantRows.map((v) => this.variantToDto(v));
  }

  async getVariant(variantId: string): Promise<ProductVariant & { product?: Product }> {
    const rows = await this.db.select({
      ...(productVariants as any),
      productTitleZh: products.titleZh,
      productTitleEn: products.titleEn,
      productStatus: products.status,
    }).from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.id, variantId)).limit(1);

    if (rows.length === 0) throw new NotFoundException('变体不存在');
    const row = rows[0] as any;
    return {
      ...this.variantToDto(row as any),
      product: {
        id: row.productId, titleZh: row.productTitleZh,
        titleEn: row.productTitleEn, status: row.productStatus,
      } as any,
    };
  }

  // ── Stock management ─────────────────────────

  async changeStock(params: StockChangeParams): Promise<ProductVariant> {
    const { variantId, delta, reason, referenceId, note, createdBy } = params;

    const existingRows = await this.db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (existingRows.length === 0) throw new NotFoundException('变体不存在');
    const existing = existingRows[0];

    const newStock = existing.stock + delta;
    if (newStock < 0) throw new BadRequestException('库存不足，无法扣减');

    const result = await this.db.transaction(async (tx) => {
      await tx.insert(stockMovements).values({
        variantId, quantity: delta, reason,
        referenceId: referenceId ?? null, note: note ?? null, createdBy: createdBy ?? null,
      });

      const variantPatch: Record<string, unknown> = { stock: newStock, updatedAt: new Date() };
      if (reason === 'sale' && delta < 0) variantPatch.sold = existing.sold + Math.abs(delta);
      else if (reason === 'refund_return' && delta > 0) variantPatch.sold = Math.max(0, existing.sold - delta);

      await tx.update(productVariants).set(variantPatch).where(eq(productVariants.id, variantId));

      const productPatch: Record<string, unknown> = { totalStock: sql`${products.totalStock} + ${delta}` };
      if (reason === 'sale' && delta < 0) productPatch.totalSold = sql`${products.totalSold} + ${Math.abs(delta)}`;
      else if (reason === 'refund_return' && delta > 0) productPatch.totalSold = sql`GREATEST(0, ${products.totalSold} - ${delta})`;

      await tx.update(products).set(productPatch).where(eq(products.id, existing.productId));

      const updated = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
      return updated[0];
    });

    return this.variantToDto(result);
  }

  // ── Validation helpers ───────────────────────

  private validateProductImages(
    coverImage: string | null | undefined,
    images: string[] | undefined,
  ): void {
    const MAX_URL_LENGTH = 500;
    const MAX_IMAGES_COUNT = 10;

    const isValidImageUrl = (url: string): boolean => {
      if (url.length > MAX_URL_LENGTH) return false;
      if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch { return false; }
    };

    if (coverImage && !isValidImageUrl(coverImage)) {
      throw new BadRequestException('封面图 URL 格式不正确，必须以 http:// 或 https:// 开头且不超过 500 字符');
    }

    if (images) {
      if (images.length > MAX_IMAGES_COUNT) {
        throw new BadRequestException(`商品图片不能超过 ${MAX_IMAGES_COUNT} 张`);
      }
      for (const img of images) {
        if (!isValidImageUrl(img)) {
          throw new BadRequestException('商品图片 URL 格式不正确，必须以 http:// 或 https:// 开头且不超过 500 字符');
        }
      }
    }
  }

  // ── Bulk import (CSV) ────────────────────────

  getImportTemplateCsv(): string {
    return 'nameZh,nameEn,category,price,stock,descriptionZh,descriptionEn,images\n';
  }

  async bulkImport(
    fileBuffer: Buffer,
    userId: string,
    auditMeta?: { role?: string; ip?: string },
  ): Promise<ImportResult> {
    const content = fileBuffer.toString('utf-8');
    const rows = this.parseCsv(content);
    if (rows.length === 0) return { successCount: 0, failCount: 0, failures: [] };

    const allCategories = await this.db.select({
      id: categories.id, nameZh: categories.nameZh, nameEn: categories.nameEn, slug: categories.slug,
    }).from(categories);

    const categoryMap = new Map<string, string>();
    for (const cat of allCategories) {
      categoryMap.set(cat.nameZh.toLowerCase(), cat.id);
      categoryMap.set(cat.nameEn.toLowerCase(), cat.id);
      categoryMap.set(cat.slug.toLowerCase(), cat.id);
    }

    const failures: ImportFailure[] = [];
    const validRecords: Array<typeof products.$inferInsert> = [];

    rows.forEach((row: ParsedCsvRow, index: number) => {
      const rowNum = index + 2;
      const reasons: string[] = [];
      if (!row.nameZh?.trim()) reasons.push('nameZh 必填');
      if (!row.nameEn?.trim()) reasons.push('nameEn 必填');
      const priceNum = Number(row.price);
      if (isNaN(priceNum) || priceNum <= 0) reasons.push('price 必须是正数');
      const stockNum = Number(row.stock);
      if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) reasons.push('stock 必须是非负整数');

      let categoryId: string | undefined;
      if (row.category?.trim()) {
        categoryId = categoryMap.get(row.category.trim().toLowerCase());
        if (!categoryId) reasons.push(`分类 "${row.category}" 未找到匹配`);
      }

      if (reasons.length > 0) {
        failures.push({ row: rowNum, reason: reasons.join('; ') });
        return;
      }

      const imageList: string[] = row.images ? row.images.split('|').map((s) => s.trim()).filter(Boolean) : [];

      validRecords.push({
        sellerId: userId,
        titleZh: row.nameZh.trim(),
        titleEn: row.nameEn.trim(),
        descZh: row.descriptionZh || undefined,
        descEn: row.descriptionEn || undefined,
        categoryId: categoryId ?? null,
        status: 'active',
        coverImage: imageList[0] ?? undefined,
        images: imageList,
        totalStock: Math.floor(stockNum),
        totalSold: 0,
        updatedBy: userId,
      });
    });

    let successCount = 0;
    if (validRecords.length > 0) {
      try {
        await this.db.transaction(async (tx) => {
          for (let i = 0; i < validRecords.length; i++) {
            const [inserted] = await tx.insert(products).values(validRecords[i]).returning();
            const row = rows[i];
            await tx.insert(productVariants).values({
              productId: inserted.id as string,
              sku: `SKU-${(inserted.id as string).slice(0, 8).toUpperCase()}`,
              optionValues: [],
              price: String(Number(row.price)),
              stock: Math.floor(Number(row.stock)),
              status: 'active',
            } as any);
          }
        });
        successCount = validRecords.length;
      } catch (error) {
        this.logger.error('批量导入商品失败', error);
        for (let i = 0; i < validRecords.length; i++) {
          failures.push({ row: i + failures.length + 2, reason: '数据库写入失败' });
        }
      }
    }

    const result: ImportResult = { successCount, failCount: failures.length, failures };
    if (successCount > 0) {
      try {
        void this.auditService.log({
          action: 'csv.import', entity: 'product', entityId: 'batch',
          after: { count: successCount }, userId, role: auditMeta?.role, ip: auditMeta?.ip,
        }).catch(() => {});
      } catch { /* noop */ }
    }
    return result;
  }

  // CSV 解析使用 papaparse（成熟开源库，正确处理 RFC 4180 转义、换行、BOM）
  private parseCsv(content: string): ParsedCsvRow[] {
    const result = Papa.parse(content as any, { skipEmptyLines: true, header: false }) as { data: string[][] };
    if (result.data.length <= 1) return [];
    return result.data.slice(1).map((fields) => ({
      nameZh: fields[0] ?? '', nameEn: fields[1] ?? '', category: fields[2] ?? '',
      price: fields[3] ?? '', stock: fields[4] ?? '',
      descriptionZh: fields[5] ?? '', descriptionEn: fields[6] ?? '', images: fields[7] ?? '',
    }));
  }
}
