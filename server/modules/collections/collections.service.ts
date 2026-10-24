import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { collections, collectionProducts, products } from '../../database/schema';
import { ProductsService } from '../products/products.service';
import {
  eq,
  and,
  desc,
  asc,
  count,
  gte,
  inArray,
  sql,
  type SQL,
} from 'drizzle-orm';

// ==================== Types ====================

export interface StorefrontSection {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  descriptionZh?: string;
  descriptionEn?: string;
  coverImage?: string;
  products: import('../../../shared/api.interface').Product[];
}

export interface SmartRule {
  field: string;
  operator: string;
  value: string | number;
}

export interface CreateCollectionDto {
  titleZh: string;
  titleEn: string;
  slug?: string;
  descriptionZh?: string;
  descriptionEn?: string;
  coverImage?: string;
  isSmart?: boolean;
  smartRules?: SmartRule[];
  isFeatured?: boolean;
  sortOrder?: number;
  status?: string;
}

export interface UpdateCollectionDto {
  titleZh?: string;
  titleEn?: string;
  slug?: string;
  descriptionZh?: string;
  descriptionEn?: string;
  coverImage?: string;
  isSmart?: boolean;
  smartRules?: SmartRule[];
  isFeatured?: boolean;
  sortOrder?: number;
  status?: string;
}

export interface ListCollectionsQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  isSmart?: boolean;
  keyword?: string;
}

export interface CollectionListItem {
  id: string;
  sellerId: string;
  titleZh: string;
  titleEn: string;
  slug: string;
  descriptionZh: string | null;
  descriptionEn: string | null;
  coverImage: string | null;
  isSmart: boolean;
  smartRules: SmartRule[] | null;
  isFeatured: boolean;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  productCount: number;
}

export interface CollectionListResponse {
  items: CollectionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CollectionProductDto {
  id: string;
  productId: string;
  sortOrder: number;
  titleZh: string;
  titleEn: string;
  coverImage: string;
  status: string;
}

export interface CollectionDetail extends CollectionListItem {
  products: CollectionProductDto[];
}

// ==================== Service ====================

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly productsService: ProductsService,
  ) {}

  // ── Slug generation ──────────────────────────

  private generateSlug(titleEn: string): string {
    const base = titleEn
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    const random = Math.random().toString(36).slice(2, 6);
    return `${base}-${random}`;
  }

  // ── Mapping helpers ───────────────────────────

  private parseSmartRules(raw: string | null): SmartRule[] | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  private toListItem(
    row: typeof collections.$inferSelect & { productCount?: number },
  ): CollectionListItem {
    return {
      id: row.id,
      sellerId: row.sellerId,
      titleZh: row.titleZh,
      titleEn: row.titleEn,
      slug: row.slug,
      descriptionZh: row.descriptionZh,
      descriptionEn: row.descriptionEn,
      coverImage: row.coverImage,
      isSmart: row.isSmart,
      smartRules: this.parseSmartRules(row.smartRules),
      isFeatured: row.isFeatured,
      sortOrder: row.sortOrder,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      productCount: row.productCount ?? 0,
    };
  }

  // ── CRUD ──────────────────────────────────────

  async create(sellerId: string, dto: CreateCollectionDto): Promise<CollectionListItem> {
    const slug = dto.slug ?? this.generateSlug(dto.titleEn);

    // Check slug uniqueness
    const existing = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('slug 已存在');
    }

    const smartRulesStr = dto.smartRules ? JSON.stringify(dto.smartRules) : null;

    try {
      const [row] = await this.db
        .insert(collections)
        .values({
          sellerId,
          titleZh: dto.titleZh,
          titleEn: dto.titleEn,
          slug,
          descriptionZh: dto.descriptionZh,
          descriptionEn: dto.descriptionEn,
          coverImage: dto.coverImage,
          isSmart: dto.isSmart ?? false,
          smartRules: smartRulesStr,
          isFeatured: dto.isFeatured ?? false,
          sortOrder: dto.sortOrder ?? 0,
          status: dto.status ?? 'active',
        })
        .returning();

      if (!row) {
        throw new BadRequestException('创建集合失败');
      }

      this.logger.log(`Collection created: ${row.id} (${row.slug})`);
      return this.toListItem({ ...row, productCount: 0 });
    } catch (error) {
      this.logger.error('Failed to create collection', error);
      throw error;
    }
  }

  async update(
    id: string,
    sellerId: string,
    dto: UpdateCollectionDto,
  ): Promise<CollectionListItem> {
    const patch: Partial<typeof collections.$inferInsert> = {};

    if (dto.titleZh !== undefined) patch.titleZh = dto.titleZh;
    if (dto.titleEn !== undefined) patch.titleEn = dto.titleEn;
    if (dto.descriptionZh !== undefined) patch.descriptionZh = dto.descriptionZh;
    if (dto.descriptionEn !== undefined) patch.descriptionEn = dto.descriptionEn;
    if (dto.coverImage !== undefined) patch.coverImage = dto.coverImage;
    if (dto.isSmart !== undefined) patch.isSmart = dto.isSmart;
    if (dto.isFeatured !== undefined) patch.isFeatured = dto.isFeatured;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) patch.status = dto.status;

    if (dto.smartRules !== undefined) {
      patch.smartRules = JSON.stringify(dto.smartRules);
    }

    if (dto.slug !== undefined) {
      const conflict = await this.db
        .select({ id: collections.id })
        .from(collections)
        .where(and(eq(collections.slug, dto.slug), sql`${collections.id} != ${id}`))
        .limit(1);

      if (conflict.length > 0) {
        throw new ConflictException('slug 已存在');
      }
      patch.slug = dto.slug;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const [row] = await this.db
      .update(collections)
      .set(patch)
      .where(and(eq(collections.id, id), eq(collections.sellerId, sellerId)))
      .returning();

    if (!row) {
      throw new NotFoundException('集合不存在');
    }

    this.logger.log(`Collection updated: ${row.id}`);
    return this.toListItem(row);
  }

  async remove(id: string, sellerId: string): Promise<{ id: string }> {
    const deleted = await this.db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.sellerId, sellerId)))
      .returning({ id: collections.id, titleEn: collections.titleEn });

    if (deleted.length === 0) {
      throw new NotFoundException('集合不存在');
    }

    this.logger.log(`Collection deleted: ${id} (${deleted[0].titleEn})`);
    return { id };
  }

  // ── Listing ───────────────────────────────────

  async list(
    sellerId: string,
    query: ListCollectionsQuery,
  ): Promise<CollectionListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [eq(collections.sellerId, sellerId)];

    if (query.status) {
      conditions.push(eq(collections.status, query.status));
    }
    if (query.isSmart !== undefined) {
      conditions.push(eq(collections.isSmart, query.isSmart));
    }
    if (query.keyword) {
      const escaped = query.keyword
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      conditions.push(
        sql`(${collections.titleZh} ILIKE ${'%' + escaped + '%'} OR ${collections.titleEn} ILIKE ${'%' + escaped + '%'})`,
      );
    }

    const whereClause = and(...conditions);

    const [countResult, rows] = await Promise.all([
      this.db.select({ count: count() }).from(collections).where(whereClause),
      this.db
        .select({
          id: collections.id,
          sellerId: collections.sellerId,
          titleZh: collections.titleZh,
          titleEn: collections.titleEn,
          slug: collections.slug,
          descriptionZh: collections.descriptionZh,
          descriptionEn: collections.descriptionEn,
          coverImage: collections.coverImage,
          isSmart: collections.isSmart,
          smartRules: collections.smartRules,
          isFeatured: collections.isFeatured,
          sortOrder: collections.sortOrder,
          status: collections.status,
          createdAt: collections.createdAt,
          updatedAt: collections.updatedAt,
          productCount: count(collectionProducts.id),
        })
        .from(collections)
        .leftJoin(
          collectionProducts,
          eq(collections.id, collectionProducts.collectionId),
        )
        .where(whereClause)
        .groupBy(collections.id)
        .orderBy(asc(collections.sortOrder), desc(collections.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: CollectionListItem[] = rows.map((row: any) =>
      this.toListItem({
        id: row.id,
        sellerId: row.sellerId,
        titleZh: row.titleZh,
        titleEn: row.titleEn,
        slug: row.slug,
        descriptionZh: row.descriptionZh,
        descriptionEn: row.descriptionEn,
        coverImage: row.coverImage,
        isSmart: row.isSmart,
        smartRules: row.smartRules,
        isFeatured: row.isFeatured,
        sortOrder: row.sortOrder,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        productCount: Number(row.productCount ?? 0),
      }),
    );

    return { items, total, page, pageSize };
  }

  // ── Detail ────────────────────────────────────

  async getOne(id: string): Promise<CollectionDetail> {
    const [row] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException('集合不存在');
    }

    // Load products for this collection (manual only; smart uses getSmartProducts)
    const productRows = await this.db
      .select({
        id: collectionProducts.id,
        productId: collectionProducts.productId,
        sortOrder: collectionProducts.sortOrder,
        titleZh: products.titleZh,
        titleEn: products.titleEn,
        coverImage: products.coverImage,
        status: products.status,
      })
      .from(collectionProducts)
      .innerJoin(products, eq(collectionProducts.productId, products.id))
      // 买家公开接口只展示上架商品；卖家后台也按同一口径展示，避免楼层里出现下架商品
      .where(and(eq(collectionProducts.collectionId, id), eq(products.status, 'active')))
      .orderBy(asc(collectionProducts.sortOrder));

    const productDtos: CollectionProductDto[] = productRows.map((pr: any) => ({
      id: pr.id,
      productId: pr.productId,
      sortOrder: pr.sortOrder ?? 0,
      titleZh: pr.titleZh,
      titleEn: pr.titleEn,
      coverImage: pr.coverImage ?? '',
      status: pr.status,
    }));

    return {
      ...this.toListItem(row),
      products: productDtos,
    };
  }

  // ── Featured (public) ─────────────────────────

  /**
   * 店铺楼层（买家首页用，公开）：精选集合 + 每个集合的完整商品（仅上架），
   * 共 3 次查询（集合 / 关联行 / 商品+变体），不随集合数增长。
   */
  async getStorefront(limitPerCollection = 8): Promise<StorefrontSection[]> {
    const sectionRows = await this.db
      .select()
      .from(collections)
      .where(and(eq(collections.isFeatured, true), eq(collections.status, 'active')))
      .orderBy(asc(collections.sortOrder), desc(collections.createdAt))
      .limit(6);

    if (sectionRows.length === 0) return [];

    const sectionIds = sectionRows.map((row) => row.id);
    const links = await this.db
      .select({
        collectionId: collectionProducts.collectionId,
        productId: collectionProducts.productId,
        sortOrder: collectionProducts.sortOrder,
      })
      .from(collectionProducts)
      .where(inArray(collectionProducts.collectionId, sectionIds))
      .orderBy(asc(collectionProducts.sortOrder));

    const idsBySection = new Map<string, string[]>();
    for (const link of links) {
      const list = idsBySection.get(link.collectionId) ?? [];
      list.push(link.productId);
      idsBySection.set(link.collectionId, list);
    }

    const allProductIds = Array.from(new Set(links.map((link) => link.productId)));
    const allProducts = await this.productsService.findByIds(allProductIds, true);
    const productMap = new Map(allProducts.map((product) => [product.id, product]));

    return sectionRows
      .map((row) => {
        const ids = (idsBySection.get(row.id) ?? []).slice(0, limitPerCollection);
        const items = ids
          .map((id) => productMap.get(id))
          .filter((product): product is NonNullable<typeof product> => Boolean(product));
        return {
          id: row.id,
          slug: row.slug,
          titleZh: row.titleZh,
          titleEn: row.titleEn,
          descriptionZh: row.descriptionZh ?? undefined,
          descriptionEn: row.descriptionEn ?? undefined,
          coverImage: row.coverImage ?? undefined,
          products: items,
        };
      })
      .filter((section) => section.products.length > 0);
  }

  /**
   * 按 slug 获取集合详情（买家端公开）：先解析 slug → id，再复用 getOne 的组装逻辑。
   * 仅返回启用状态的集合。
   */
  async getBySlug(slug: string): Promise<CollectionDetail> {
    const [row] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.slug, slug), eq(collections.status, 'active')))
      .limit(1);

    if (!row) {
      throw new NotFoundException('集合不存在');
    }
    return this.getOne(row.id);
  }

  async getFeatured(): Promise<CollectionListItem[]> {
    const rows = await this.db
      .select()
      .from(collections)
      .where(and(eq(collections.isFeatured, true), eq(collections.status, 'active')))
      .orderBy(asc(collections.sortOrder), desc(collections.createdAt))
      .limit(20);

    return rows.map((row) => this.toListItem(row));
  }

  // ── Product management ────────────────────────

  async addProduct(
    collectionId: string,
    sellerId: string,
    productId: string,
  ): Promise<CollectionListItem> {
    // Verify collection ownership
    const [collection] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.sellerId, sellerId)))
      .limit(1);

    if (!collection) {
      throw new NotFoundException('集合不存在');
    }

    // Verify product exists
    const [product] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    // Check if already in collection
    const [existing] = await this.db
      .select({ id: collectionProducts.id })
      .from(collectionProducts)
      .where(
        and(
          eq(collectionProducts.collectionId, collectionId),
          eq(collectionProducts.productId, productId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('商品已在集合中');
    }

    // Get max sortOrder for the next position
    const [maxOrderRow] = await this.db
      .select({ maxSort: sql<number>`COALESCE(MAX(${collectionProducts.sortOrder}), -1)` })
      .from(collectionProducts)
      .where(eq(collectionProducts.collectionId, collectionId));

    const nextSortOrder = (maxOrderRow?.maxSort ?? -1) + 1;

    await this.db
      .insert(collectionProducts)
      .values({
        collectionId,
        productId,
        sortOrder: nextSortOrder,
      });

    this.logger.log(`Product ${productId} added to collection ${collectionId}`);

    // Return updated collection
    return this.toListItem(
      await this.getCollectionRow(collectionId, sellerId),
    );
  }

  async removeProduct(
    collectionId: string,
    sellerId: string,
    productId: string,
  ): Promise<{ collectionId: string; productId: string }> {
    // Verify collection ownership
    const [collection] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.sellerId, sellerId)))
      .limit(1);

    if (!collection) {
      throw new NotFoundException('集合不存在');
    }

    const deleted = await this.db
      .delete(collectionProducts)
      .where(
        and(
          eq(collectionProducts.collectionId, collectionId),
          eq(collectionProducts.productId, productId),
        ),
      )
      .returning({ id: collectionProducts.id });

    if (deleted.length === 0) {
      throw new NotFoundException('商品不在集合中');
    }

    this.logger.log(`Product ${productId} removed from collection ${collectionId}`);
    return { collectionId, productId };
  }

  async reorderProducts(
    collectionId: string,
    sellerId: string,
    productIds: string[],
  ): Promise<CollectionListItem> {
    // Verify collection ownership
    const [collection] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.sellerId, sellerId)))
      .limit(1);

    if (!collection) {
      throw new NotFoundException('集合不存在');
    }

    // Verify all products belong to this collection
    const existingProducts = await this.db
      .select({ productId: collectionProducts.productId })
      .from(collectionProducts)
      .where(eq(collectionProducts.collectionId, collectionId));

    const existingSet = new Set(existingProducts.map((p) => p.productId));
    for (const pid of productIds) {
      if (!existingSet.has(pid)) {
        throw new BadRequestException(`Product ${pid} not in collection`);
      }
    }

    // Update sortOrder for each product
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < productIds.length; i++) {
        await tx
          .update(collectionProducts)
          .set({ sortOrder: i })
          .where(
            and(
              eq(collectionProducts.collectionId, collectionId),
              eq(collectionProducts.productId, productIds[i]),
            ),
          );
      }
    });

    this.logger.log(`Collection ${collectionId} products reordered`);
    return this.toListItem(
      await this.getCollectionRow(collectionId, sellerId),
    );
  }

  // ── Smart product matching ────────────────────

  async getSmartProducts(collectionId: string): Promise<CollectionProductDto[]> {
    const [collectionRow] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (!collectionRow) {
      throw new NotFoundException('集合不存在');
    }

    if (!collectionRow.isSmart || !collectionRow.smartRules) {
      return [];
    }

    const rules = this.parseSmartRules(collectionRow.smartRules);
    if (!rules || rules.length === 0) {
      return [];
    }

    // Build WHERE conditions from smart rules
    const conditions: SQL[] = [];

    for (const rule of rules) {
      switch (rule.field) {
        case 'category':
          if (rule.operator === 'eq' && rule.value) {
            conditions.push(eq(products.categoryId, String(rule.value)));
          }
          break;
        case 'minSold':
          if (rule.operator === 'gte' && typeof rule.value === 'number') {
            conditions.push(gte(products.totalSold, rule.value));
          }
          break;
        case 'status':
          if (rule.operator === 'eq' && rule.value) {
            conditions.push(eq(products.status, String(rule.value)));
          }
          break;
        default:
          // Unknown rule field, skip
          break;
      }
    }

    if (conditions.length === 0) {
      return [];
    }

    const whereClause = and(...conditions);

    const rows = await this.db
      .select({
        productId: products.id,
        titleZh: products.titleZh,
        titleEn: products.titleEn,
        coverImage: products.coverImage,
        status: products.status,
      })
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.totalSold), desc(products.createdAt))
      .limit(60);

    return rows.map((row: any) => ({
      id: row.productId,
      productId: row.productId,
      sortOrder: 0,
      titleZh: row.titleZh,
      titleEn: row.titleEn,
      coverImage: row.coverImage ?? '',
      status: row.status,
    }));
  }

  // ── Private helpers ───────────────────────────

  private async getCollectionRow(
    collectionId: string,
    sellerId: string,
  ): Promise<typeof collections.$inferSelect & { productCount: number }> {
    const [row] = await this.db
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.sellerId, sellerId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('集合不存在');
    }

    const [countResult] = await this.db
      .select({ count: count() })
      .from(collectionProducts)
      .where(eq(collectionProducts.collectionId, collectionId));

    return { ...row, productCount: Number(countResult?.count ?? 0) };
  }
}
