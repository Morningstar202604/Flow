import {
  Injectable,
  Inject,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';

import { favorites, products, productVariants } from '@server/database/schema';
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

    if (rows.length === 0) return [];

    // Batch-load variant aggregates for all products
    const productIds = [...new Set(rows.map((r) => r.productId))];
    const variantAgg = await this.db
      .select({
        productId: productVariants.productId,
        totalSold: sql<number>`COALESCE(SUM(${productVariants.sold}), 0)`,
        totalStock: sql<number>`COALESCE(SUM(${productVariants.stock}), 0)`,
        minPrice: sql<string>`MIN(${productVariants.price})::text`,
        maxPrice: sql<string>`MAX(${productVariants.price})::text`,
        minOriginalPrice: sql<string>`MIN(${productVariants.originalPrice})::text`,
        sampleSku: sql<string>`MIN(${productVariants.sku})`,
      })
      .from(productVariants)
      .where(and(
        inArray(productVariants.productId, productIds),
        eq(productVariants.status, 'active'),
      ))
      .groupBy(productVariants.productId);

    const variantMap = new Map(variantAgg.map((v) => [v.productId, v]));

    return rows.map((row) => {
      const v = variantMap.get(row.productId);
      return {
        id: row.id,
        userId: row.userId,
        productId: row.productId,
        createdAt: row.createdAt.toISOString(),
        product: {
          id: row.product.id,
          sellerId: row.product.sellerId,
          titleZh: row.product.titleZh,
          titleEn: row.product.titleEn,
          descZh: row.product.descZh ?? '',
          descEn: row.product.descEn ?? '',
          longDescZh: row.product.longDescZh ?? '',
          longDescEn: row.product.longDescEn ?? '',
          categoryId: row.product.categoryId ?? undefined,
          coverImage: row.product.coverImage,
          images: row.product.images ?? [],
          bulletPointsZh: row.product.bulletPointsZh ?? [],
          bulletPointsEn: row.product.bulletPointsEn ?? [],
          optionNames: row.product.optionNames ?? [],
          variants: [],
          minPrice: v ? String(v.minPrice) : undefined,
          maxPrice: v ? String(v.maxPrice) : undefined,
          totalStock: v ? Number(v.totalStock) : Number(row.product.totalStock ?? 0),
          totalSold: v ? Number(v.totalSold) : Number(row.product.totalSold ?? 0),
          status: row.product.status as any,
          weight: row.product.weight ?? undefined,
          avgRating: row.product.avgRating != null ? Number(row.product.avgRating) : undefined,
          reviewCount: row.product.reviewCount ?? undefined,
          seoKeywordsZh: row.product.seoKeywordsZh ?? '',
          seoKeywordsEn: row.product.seoKeywordsEn ?? '',
          createdAt: row.product.createdAt.toISOString(),
          updatedAt: row.product.updatedAt.toISOString(),
        },
      };
    });
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

  async toggle(productId: string, userId: string | undefined): Promise<{ favorited: boolean; id?: string }> {
    if (!userId) throw new ForbiddenException('请先登录');
    const existing = await this.db
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.productId, productId)))
      .limit(1);
    if (existing.length > 0) {
      await this.db.delete(favorites).where(eq(favorites.id, existing[0].id));
      return { favorited: false };
    }
    const inserted = await this.db.insert(favorites).values({ userId, productId }).returning({ id: favorites.id });
    return { favorited: true, id: inserted[0].id };
  }

}
