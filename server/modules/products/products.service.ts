import { Injectable, Inject, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { products, categories, reviews } from '@server/database/schema';
import { eq, and, count, desc, asc, ilike, gte, lte, sql } from 'drizzle-orm';
import type {
  Product,
  ProductListResponse,
  ProductListParams,
  CreateProductRequest,
  UpdateProductRequest,
  ProductSpec,
} from '@shared/api.interface';
import { AuditService } from '../audit/audit.service';

export interface ImportFailure {
  row: number;
  reason: string;
}

export interface ImportResult {
  successCount: number;
  failCount: number;
  failures: ImportFailure[];
}

interface ParsedCsvRow {
  nameZh: string;
  nameEn: string;
  category: string;
  price: string;
  stock: string;
  descriptionZh: string;
  descriptionEn: string;
  images: string;
}

type ProductWithCategory = typeof products.$inferSelect & {
  categoryNameZh: string | null;
  categoryNameEn: string | null;
  avgRating: number | null;
  reviewCount: number | null;
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  private toDto(row: ProductWithCategory): Product {
    return {
      id: row.id,
      sku: row.sku ?? undefined,
      titleZh: row.titleZh,
      titleEn: row.titleEn,
      descZh: row.descZh ?? '',
      descEn: row.descEn ?? '',
      longDescZh: row.longDescZh ?? '',
      longDescEn: row.longDescEn ?? '',
      categoryId: row.categoryId ?? undefined,
      categoryNameZh: row.categoryNameZh ?? undefined,
      categoryNameEn: row.categoryNameEn ?? undefined,
      price: String(row.price),
      originalPrice: row.originalPrice ? String(row.originalPrice) : undefined,
      stock: row.stock,
      sold: row.sold,
      status: row.status as 'draft' | 'active' | 'inactive',
      coverImage: row.coverImage ?? undefined,
      images: row.images ?? [],
      specs: row.specs ? JSON.parse(row.specs) as ProductSpec : {},
      seoKeywordsZh: row.seoKeywordsZh ?? '',
      seoKeywordsEn: row.seoKeywordsEn ?? '',
      bulletPointsZh: row.bulletPointsZh ?? [],
      bulletPointsEn: row.bulletPointsEn ?? [],
      weight: row.weight ? String(row.weight) : undefined,
      avgRating: row.avgRating != null ? Number(row.avgRating) : undefined,
      reviewCount: row.reviewCount != null ? Number(row.reviewCount) : undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private buildWhere(params: ProductListParams) {
    const conditions = [];

    if (params.status !== undefined) {
      conditions.push(eq(products.status, params.status));
    } else {
      conditions.push(eq(products.status, 'active'));
    }

    if (params.categoryId) {
      conditions.push(eq(products.categoryId, params.categoryId));
    }

    if (params.keyword) {
      const escaped = params.keyword.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const keyword = `%${escaped}%`;
      conditions.push(
        sql`(${ilike(products.titleZh, keyword)} OR ${ilike(products.titleEn, keyword)})`
      );
    }

    if (params.minPrice !== undefined) {
      conditions.push(gte(products.price, String(params.minPrice)));
    }

    if (params.maxPrice !== undefined) {
      conditions.push(lte(products.price, String(params.maxPrice)));
    }

    return conditions;
  }

  private getOrderBy(sortBy: ProductListParams['sortBy']) {
    switch (sortBy) {
      case 'price_asc':
        return [asc(products.price)];
      case 'price_desc':
        return [desc(products.price)];
      case 'sold_desc':
        return [desc(products.sold)];
      case 'newest':
      default:
        return [desc(products.createdAt)];
    }
  }

  async findAll(params: ProductListParams): Promise<ProductListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const conditions = this.buildWhere(params);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const orderBy = this.getOrderBy(params.sortBy);

    const baseQuery = this.db
      .select({
        ...(products as any),
        categoryNameZh: categories.nameZh,
        categoryNameEn: categories.nameEn,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(whereClause)
      .orderBy(...orderBy, desc(products.id));

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(products)
        .where(whereClause),
      baseQuery.limit(pageSize).offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items = (rows as unknown as ProductWithCategory[]).map((row: ProductWithCategory) =>
      this.toDto(row),
    );

    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<Product> {
    const rows = await this.db
      .select({
        ...(products as any),
        categoryNameZh: categories.nameZh,
        categoryNameEn: categories.nameEn,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('商品不存在');
    }

    const result = this.toDto(rows[0] as unknown as ProductWithCategory);

    const reviewStats = await this.db
      .select({
        avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 1)`,
        reviewCount: count(reviews.id),
      })
      .from(reviews)
      .where(eq(reviews.productId, id));

    if (reviewStats.length > 0) {
      result.avgRating = reviewStats[0].avgRating != null ? Number(reviewStats[0].avgRating) : 0;
      result.reviewCount = Number(reviewStats[0].reviewCount);
    } else {
      result.avgRating = 0;
      result.reviewCount = 0;
    }

    return result;
  }

  async getFeatured(): Promise<Product[]> {
    const rows = await this.db
      .select({
        ...(products as any),
        categoryNameZh: categories.nameZh,
        categoryNameEn: categories.nameEn,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.status, 'active'))
      .orderBy(desc(products.sold), desc(products.createdAt))
      .limit(8);

    return (rows as unknown as ProductWithCategory[]).map((row: ProductWithCategory) =>
      this.toDto(row),
    );
  }

  async create(input: CreateProductRequest, userId: string): Promise<Product> {
    try {
      this.validateProductImages(input.coverImage, input.images);

      const [row] = await this.db
        .insert(products)
        .values({
          sellerId: userId,
          sku: input.sku,
          titleZh: input.titleZh,
          titleEn: input.titleEn,
          descZh: input.descZh,
          descEn: input.descEn,
          longDescZh: input.longDescZh,
          longDescEn: input.longDescEn,
          categoryId: input.categoryId,
          price: String(input.price),
          originalPrice: input.originalPrice !== undefined ? String(input.originalPrice) : undefined,
          stock: input.stock ?? 0,
          status: input.status ?? 'draft',
          coverImage: input.coverImage,
          images: input.images ?? [],
          specs: input.specs ? JSON.stringify(input.specs) : '{}',
          seoKeywordsZh: input.seoKeywordsZh,
          seoKeywordsEn: input.seoKeywordsEn,
          bulletPointsZh: input.bulletPointsZh ?? [],
          bulletPointsEn: input.bulletPointsEn ?? [],
          weight: input.weight !== undefined ? String(input.weight) : undefined,
        })
        .returning();

      if (!row) {
        throw new BadRequestException('创建商品失败');
      }

      return this.findOne(row.id);
    } catch (error) {
      this.logger.error('创建商品失败', error);
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateProductRequest,
    userId: string,
    auditMeta?: { role?: string; ip?: string },
  ): Promise<Product> {
    // Query current product for before-value audit
    const existingRows = await this.db
      .select({ price: products.price, status: products.status })
      .from(products)
      .where(eq(products.id, id));
    if (existingRows.length === 0) {
      throw new NotFoundException('商品不存在');
    }
    const existing = existingRows[0];
    const oldPrice = existing.price as string;
    const oldStatus = existing.status as string;
    const patch: Partial<typeof products.$inferInsert> = {};

    if (input.coverImage !== undefined || input.images !== undefined) {
      this.validateProductImages(
        input.coverImage ?? undefined,
        input.images ?? undefined,
      );
    }

    if (input.sku !== undefined) patch.sku = input.sku;
    if (input.titleZh !== undefined) patch.titleZh = input.titleZh;
    if (input.titleEn !== undefined) patch.titleEn = input.titleEn;
    if (input.descZh !== undefined) patch.descZh = input.descZh;
    if (input.descEn !== undefined) patch.descEn = input.descEn;
    if (input.longDescZh !== undefined) patch.longDescZh = input.longDescZh;
    if (input.longDescEn !== undefined) patch.longDescEn = input.longDescEn;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.price !== undefined) patch.price = String(input.price);
    if (input.originalPrice !== undefined) patch.originalPrice = String(input.originalPrice);
    if (input.stock !== undefined) patch.stock = input.stock;
    if (input.status !== undefined) patch.status = input.status;
    if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
    if (input.images !== undefined) patch.images = input.images;
    if (input.specs !== undefined) patch.specs = JSON.stringify(input.specs);
    if (input.seoKeywordsZh !== undefined) patch.seoKeywordsZh = input.seoKeywordsZh;
    if (input.seoKeywordsEn !== undefined) patch.seoKeywordsEn = input.seoKeywordsEn;
    if (input.bulletPointsZh !== undefined) patch.bulletPointsZh = input.bulletPointsZh;
    if (input.bulletPointsEn !== undefined) patch.bulletPointsEn = input.bulletPointsEn;
    if (input.weight !== undefined) patch.weight = String(input.weight);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const updated = await this.db
      .update(products)
      .set(patch)
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (updated.length === 0) {
      throw new NotFoundException('商品不存在');
    }

    const result = await this.findOne(id);

    // Audit log: price change
    if (input.price !== undefined && String(input.price) !== oldPrice) {
      try {
        void this.auditService.log({
          action: 'product.price_change',
          entity: 'product',
          entityId: id,
          before: { oldPrice },
          after: { newPrice: String(input.price) },
          userId: userId,
          role: auditMeta?.role,
          ip: auditMeta?.ip,
        }).catch(() => {});
      } catch {
        // Audit log failure must not affect main flow
      }
    }

    // Audit log: status toggle
    if (input.status !== undefined && input.status !== oldStatus) {
      try {
        void this.auditService.log({
          action: 'product.toggle_status',
          entity: 'product',
          entityId: id,
          before: { oldStatus },
          after: { newStatus: input.status },
          userId: userId,
          role: auditMeta?.role,
          ip: auditMeta?.ip,
        }).catch(() => {});
      } catch {
        // Audit log failure must not affect main flow
      }
    }

    return result;
  }

  async remove(id: string): Promise<{ id: string }> {
    const deleted = await this.db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (deleted.length === 0) {
      throw new NotFoundException('商品不存在');
    }

    return { id };
  }

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
      } catch {
        return false;
      }
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

    if (rows.length === 0) {
      return { successCount: 0, failCount: 0, failures: [] };
    }

    // Load all categories for matching
    const allCategories = await this.db.select({
      id: categories.id,
      nameZh: categories.nameZh,
      nameEn: categories.nameEn,
      slug: categories.slug,
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
      const rowNum = index + 2; // row 1 is header
      const reasons: string[] = [];

      if (!row.nameZh || row.nameZh.trim() === '') {
        reasons.push('nameZh 必填');
      }
      if (!row.nameEn || row.nameEn.trim() === '') {
        reasons.push('nameEn 必填');
      }

      const priceNum = Number(row.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        reasons.push('price 必须是正数');
      }

      const stockNum = Number(row.stock);
      if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
        reasons.push('stock 必须是非负整数');
      }

      let categoryId: string | undefined;
      if (row.category && row.category.trim() !== '') {
        categoryId = categoryMap.get(row.category.trim().toLowerCase());
        if (!categoryId) {
          reasons.push(`分类 "${row.category}" 未找到匹配`);
        }
      }

      if (reasons.length > 0) {
        failures.push({ row: rowNum, reason: reasons.join('; ') });
        return;
      }

      const imageList: string[] = row.images
        ? row.images.split('|').map((s: string) => s.trim()).filter(Boolean)
        : [];

      validRecords.push({
        sellerId: userId,
        titleZh: row.nameZh.trim(),
        titleEn: row.nameEn.trim(),
        descZh: row.descriptionZh || null,
        descEn: row.descriptionEn || null,
        categoryId,
        price: String(priceNum),
        stock: Math.floor(stockNum),
        status: 'active',
        coverImage: imageList[0] ?? null,
        images: imageList,
        updatedBy: userId,
      });
    });

    let successCount = 0;
    if (validRecords.length > 0) {
      try {
        // Insert in batches of 100
        const batchSize = 100;
        for (let i = 0; i < validRecords.length; i += batchSize) {
          const batch = validRecords.slice(i, i + batchSize);
          await this.db.insert(products).values(batch);
        }
        successCount = validRecords.length;
      } catch (error) {
        this.logger.error('批量导入商品失败', error);
        // Mark all valid records as failed
        for (let i = 0; i < validRecords.length; i++) {
          const rowNum = rows.findIndex((_r: ParsedCsvRow, idx: number) => {
            // find the original row index
            const originalIdx = idx + 2;
            return !failures.some((f: ImportFailure) => f.row === originalIdx) &&
              failures.length + validRecords.length === rows.length &&
              i === idx - failures.filter((f: ImportFailure) => f.row < originalIdx).length;
          });
          failures.push({
            row: i + failures.length + 2,
            reason: '数据库写入失败',
          });
        }
      }
    }

    const result: ImportResult = {
      successCount,
      failCount: failures.length,
      failures,
    };

    // Audit log for CSV import
    if (successCount > 0) {
      try {
        void this.auditService.log({
          action: 'csv.import',
          entity: 'product',
          entityId: 'batch',
          after: { count: successCount },
          userId: userId,
          role: auditMeta?.role,
          ip: auditMeta?.ip,
        }).catch(() => {});
      } catch {
        // Audit log failure must not affect main flow
      }
    }

    return result;
  }

  private parseCsv(content: string): ParsedCsvRow[] {
    const lines = content.split(/\r?\n/).filter((line: string) => line.trim() !== '');

    if (lines.length <= 1) {
      return [];
    }

    // Skip header line
    const dataLines = lines.slice(1);

    const result: ParsedCsvRow[] = [];
    for (const line of dataLines) {
      const fields = this.parseCsvLine(line);
      result.push({
        nameZh: fields[0] ?? '',
        nameEn: fields[1] ?? '',
        category: fields[2] ?? '',
        price: fields[3] ?? '',
        stock: fields[4] ?? '',
        descriptionZh: fields[5] ?? '',
        descriptionEn: fields[6] ?? '',
        images: fields[7] ?? '',
      });
    }

    return result;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current);
    return result;
  }
}
