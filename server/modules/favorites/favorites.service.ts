import {
  Injectable,
  Inject,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, desc, and, inArray } from 'drizzle-orm';

import { favorites, products } from '@server/database/schema';
import type { FavoriteProduct } from '@shared/api.interface';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async getMyFavorites(userId: string | undefined): Promise<FavoriteProduct[]> {
    if (!userId) return [];

    const rows = await this.db
      .select({
        id: favorites.id,
        userId: favorites.userId,
        productId: favorites.productId,
        createdAt: favorites.createdAt,
        product: products,
      })
      .from(favorites)
      .innerJoin(products, eq(favorites.productId, products.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      productId: row.productId,
      createdAt: row.createdAt.toISOString(),
      product: {
        id: row.product.id,
        sku: row.product.sku ?? undefined,
        titleZh: row.product.titleZh,
        titleEn: row.product.titleEn,
        descZh: row.product.descZh ?? '',
        descEn: row.product.descEn ?? '',
        longDescZh: row.product.longDescZh ?? '',
        longDescEn: row.product.longDescEn ?? '',
        categoryId: row.product.categoryId ?? undefined,
        price: row.product.price.toString(),
        originalPrice: row.product.originalPrice?.toString(),
        stock: Number(row.product.stock),
        sold: Number(row.product.sold),
        status: row.product.status as any,
        coverImage: row.product.coverImage ?? undefined,
        images: (row.product.images as string[]) ?? [],
        specs: row.product.specs as any,
        seoKeywordsZh: row.product.seoKeywordsZh ?? '',
        seoKeywordsEn: row.product.seoKeywordsEn ?? '',
        bulletPointsZh: (row.product.bulletPointsZh as string[]) ?? [],
        bulletPointsEn: (row.product.bulletPointsEn as string[]) ?? [],
        weight: row.product.weight?.toString(),
        createdAt: row.product.createdAt.toISOString(),
        updatedAt: row.product.updatedAt.toISOString(),
      },
    }));
  }

  async toggle(productId: string, userId: string | undefined): Promise<{
    favorited: boolean;
    id?: string;
  }> {
    if (!userId) {
      throw new ForbiddenException('请先登录');
    }

    const productRows = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));
    if (productRows.length === 0) {
      throw new NotFoundException('商品不存在');
    }

    const existing = await this.db
      .select({ id: favorites.id })
      .from(favorites)
      .where(
        and(eq(favorites.userId, userId), eq(favorites.productId, productId)),
      );

    if (existing.length > 0) {
      await this.db
        .delete(favorites)
        .where(eq(favorites.id, existing[0].id));
      return { favorited: false };
    }

    const inserted = await this.db
      .insert(favorites)
      .values({ userId, productId })
      .returning({ id: favorites.id });

    return { favorited: true, id: inserted[0].id };
  }

  async isFavoritedBatch(
    productIds: string[],
    userId: string | undefined,
  ): Promise<string[]> {
    if (!userId || productIds.length === 0) return [];
    const rows = await this.db
      .select({ productId: favorites.productId })
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          inArray(favorites.productId, productIds),
        ),
      );
    return rows.map((row) => row.productId);
  }

  async isFavorited(productId: string, userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const rows = await this.db
      .select({ id: favorites.id })
      .from(favorites)
      .where(
        and(eq(favorites.userId, userId), eq(favorites.productId, productId)),
      )
      .limit(1);
    return rows.length > 0;
  }
}
