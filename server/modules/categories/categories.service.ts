import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { categories } from '@server/database/schema';
import { eq, asc } from 'drizzle-orm';
import type { Category } from '@shared/api.interface';

interface CreateCategoryInput {
  nameZh: string;
  nameEn: string;
  slug: string;
  icon?: string;
  sortOrder?: number;
}

interface UpdateCategoryInput {
  nameZh?: string;
  nameEn?: string;
  slug?: string;
  icon?: string;
  sortOrder?: number;
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  private toDto(row: typeof categories.$inferSelect): Category {
    return {
      id: row.id,
      nameZh: row.nameZh,
      nameEn: row.nameEn,
      slug: row.slug,
      icon: row.icon ?? undefined,
      sortOrder: row.sortOrder ?? 0,
    };
  }

  async findAll(): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.nameZh));

    return rows.map((row: typeof categories.$inferSelect) => this.toDto(row));
  }

  async create(input: CreateCategoryInput, userId: string): Promise<Category> {
    try {
      const [row] = await this.db
        .insert(categories)
        .values({
          nameZh: input.nameZh,
          nameEn: input.nameEn,
          slug: input.slug,
          icon: input.icon,
          sortOrder: input.sortOrder ?? 0,
          updatedBy: userId,
        })
        .returning();

      if (!row) {
        throw new BadRequestException('创建分类失败');
      }

      return this.toDto(row);
    } catch (error) {
      this.logger.error('创建分类失败', error);
      throw error;
    }
  }

  async update(id: string, input: UpdateCategoryInput, userId: string): Promise<Category> {
    const patch: Partial<typeof categories.$inferInsert> = {};
    if (input.nameZh !== undefined) patch.nameZh = input.nameZh;
    if (input.nameEn !== undefined) patch.nameEn = input.nameEn;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const [row] = await this.db
      .update(categories)
      .set(patch)
      .where(eq(categories.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('分类不存在');
    }

    return this.toDto(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const deleted = await this.db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });

    if (deleted.length === 0) {
      throw new NotFoundException('分类不存在');
    }

    return { id };
  }
}
