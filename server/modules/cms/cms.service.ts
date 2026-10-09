import { Injectable, Inject, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { cmsPages } from '@server/database/schema';
import { eq, and, desc, count, ilike } from 'drizzle-orm';

interface CreateCmsPageInput {
  slug?: string;
  titleZh: string;
  titleEn: string;
  contentZh?: string;
  contentEn?: string;
  metaTitleZh?: string;
  metaTitleEn?: string;
  metaDescZh?: string;
  metaDescEn?: string;
  isPublished?: boolean;
}

interface UpdateCmsPageInput {
  slug?: string;
  titleZh?: string;
  titleEn?: string;
  contentZh?: string;
  contentEn?: string;
  metaTitleZh?: string;
  metaTitleEn?: string;
  metaDescZh?: string;
  metaDescEn?: string;
  isPublished?: boolean;
}

interface CmsPageListQuery {
  page?: number;
  pageSize?: number;
  isPublished?: boolean;
  slug?: string;
}

export interface CmsPageListItem {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CmsPageDetail extends CmsPageListItem {
  contentZh: string;
  contentEn: string;
  metaTitleZh?: string;
  metaTitleEn?: string;
  metaDescZh?: string;
  metaDescEn?: string;
}

export interface CmsPageListResponse {
  items: CmsPageListItem[];
  total: number;
  page: number;
  pageSize: number;
}

function generateSlug(titleEn: string): string {
  const base = titleEn
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  private toDetail(row: typeof cmsPages.$inferSelect): CmsPageDetail {
    return {
      id: row.id,
      slug: row.slug,
      titleZh: row.titleZh,
      titleEn: row.titleEn,
      contentZh: row.contentZh,
      contentEn: row.contentEn,
      metaTitleZh: row.metaTitleZh ?? undefined,
      metaTitleEn: row.metaTitleEn ?? undefined,
      metaDescZh: row.metaDescZh ?? undefined,
      metaDescEn: row.metaDescEn ?? undefined,
      isPublished: row.isPublished,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toListItem(row: typeof cmsPages.$inferSelect): CmsPageListItem {
    return {
      id: row.id,
      slug: row.slug,
      titleZh: row.titleZh,
      titleEn: row.titleEn,
      isPublished: row.isPublished,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateCmsPageInput): Promise<CmsPageDetail> {
    const slug = dto.slug ?? generateSlug(dto.titleEn);

    const existing = await this.db
      .select({ id: cmsPages.id })
      .from(cmsPages)
      .where(eq(cmsPages.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('slug 已存在');
    }

    const [row] = await this.db
      .insert(cmsPages)
      .values({
        slug,
        titleZh: dto.titleZh,
        titleEn: dto.titleEn,
        contentZh: dto.contentZh ?? '',
        contentEn: dto.contentEn ?? '',
        metaTitleZh: dto.metaTitleZh,
        metaTitleEn: dto.metaTitleEn,
        metaDescZh: dto.metaDescZh,
        metaDescEn: dto.metaDescEn,
        isPublished: dto.isPublished ?? false,
      })
      .returning();

    if (!row) {
      throw new BadRequestException('创建页面失败');
    }

    return this.toDetail(row);
  }

  async update(id: string, dto: UpdateCmsPageInput): Promise<CmsPageDetail> {
    const patch: Partial<typeof cmsPages.$inferInsert> = {};
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.titleZh !== undefined) patch.titleZh = dto.titleZh;
    if (dto.titleEn !== undefined) patch.titleEn = dto.titleEn;
    if (dto.contentZh !== undefined) patch.contentZh = dto.contentZh;
    if (dto.contentEn !== undefined) patch.contentEn = dto.contentEn;
    if (dto.metaTitleZh !== undefined) patch.metaTitleZh = dto.metaTitleZh;
    if (dto.metaTitleEn !== undefined) patch.metaTitleEn = dto.metaTitleEn;
    if (dto.metaDescZh !== undefined) patch.metaDescZh = dto.metaDescZh;
    if (dto.metaDescEn !== undefined) patch.metaDescEn = dto.metaDescEn;
    if (dto.isPublished !== undefined) patch.isPublished = dto.isPublished;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const [row] = await this.db
      .update(cmsPages)
      .set(patch)
      .where(eq(cmsPages.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('页面不存在');
    }

    return this.toDetail(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const deleted = await this.db
      .delete(cmsPages)
      .where(eq(cmsPages.id, id))
      .returning({ id: cmsPages.id });

    if (deleted.length === 0) {
      throw new NotFoundException('页面不存在');
    }

    return { id };
  }

  async list(query: CmsPageListQuery): Promise<CmsPageListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;

    const conditions = [];
    if (query.isPublished !== undefined) {
      conditions.push(eq(cmsPages.isPublished, query.isPublished));
    }
    if (query.slug) {
      conditions.push(ilike(cmsPages.slug, `%${query.slug}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      this.db.select({ count: count() }).from(cmsPages).where(whereClause),
      this.db
        .select()
        .from(cmsPages)
        .where(whereClause)
        .orderBy(desc(cmsPages.updatedAt))
        .limit(safePageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items = rows.map((row: typeof cmsPages.$inferSelect) => this.toListItem(row));

    return { items, total, page: safePage, pageSize: safePageSize };
  }

  async getById(id: string): Promise<CmsPageDetail> {
    const [row] = await this.db
      .select()
      .from(cmsPages)
      .where(eq(cmsPages.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException('页面不存在');
    }

    return this.toDetail(row);
  }

  async getBySlug(slug: string): Promise<CmsPageDetail> {
    const [row] = await this.db
      .select()
      .from(cmsPages)
      .where(and(eq(cmsPages.slug, slug), eq(cmsPages.isPublished, true)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('页面不存在或未发布');
    }

    return this.toDetail(row);
  }
}
