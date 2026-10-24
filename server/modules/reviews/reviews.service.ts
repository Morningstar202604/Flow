import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { reviews, products, orders, orderItems, users } from '../../database/schema';
import type {
  ProductReview,
  ProductReviewsResponse,
  CreateReviewRequest,
} from '../../../shared/api.interface';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async getProductReviews(productId: string): Promise<ProductReviewsResponse> {
    const productRows = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));
    if (productRows.length === 0) {
      throw new NotFoundException('商品不存在');
    }

    const rows = await this.db
      .select({
        id: reviews.id,
        productId: reviews.productId,
        userId: reviews.userId,
        userName: users.name,
        rating: reviews.rating,
        content: reviews.content,
        images: reviews.images,
        sellerReply: reviews.sellerReply,
        verifiedPurchase: reviews.verifiedPurchase,
        helpfulCount: reviews.helpfulCount,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));

    const avgResult = await this.db
      .select({ avg: sql<number>`AVG(${reviews.rating})::numeric` })
      .from(reviews)
      .where(eq(reviews.productId, productId));

    const countResult = await this.db
      .select({ count: count() })
      .from(reviews)
      .where(eq(reviews.productId, productId));

    const items: ProductReview[] = rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      userId: row.userId,
      userName: row.userName,
      rating: Number(row.rating),
      content: row.content ?? undefined,
      images: row.images ?? [],
      sellerReply: row.sellerReply ?? undefined,
      verifiedPurchase: row.verifiedPurchase,
      helpfulCount: row.helpfulCount,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      averageRating: avgResult[0]?.avg ? Number(avgResult[0].avg) : 0,
      totalCount: Number(countResult[0]?.count ?? 0),
    };
  }

  async createReview(
    productId: string,
    userId: string,
    dto: CreateReviewRequest,
  ): Promise<ProductReview> {
    if (!userId) {
      throw new ForbiddenException('请先登录后评价');
    }
    if (!dto.rating || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('评分必须在 1-5 之间');
    }

    const productRows = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));
    if (productRows.length === 0) {
      throw new NotFoundException('商品不存在');
    }

    const existing = await this.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(
        and(eq(reviews.productId, productId), eq(reviews.userId, userId)),
      );
    if (existing.length > 0) {
      throw new ConflictException('你已评价过该商品');
    }

    const purchasedRows = await this.db
      .select({ id: orderItems.id })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.productId, productId),
          eq(orders.userId, userId),
          sql`${orders.status} IN ('paid', 'shipped', 'delivered')`,
        ),
      )
      .limit(1);

    if (purchasedRows.length === 0) {
      throw new ForbiddenException('请先购买该商品后再评价');
    }

    const inserted = await this.db
      .insert(reviews)
      .values({
        productId,
        userId,
        rating: dto.rating,
        content: dto.comment ?? undefined,
        images: (dto.images ?? []).slice(0, 6),
        verifiedPurchase: true,
      })
      .returning();

    const userRows = await this.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId));

    return {
      id: inserted[0].id,
      productId: inserted[0].productId,
      userId: inserted[0].userId,
      userName: userRows[0]?.name ?? '用户',
      rating: Number(inserted[0].rating),
      comment: inserted[0].content ?? undefined,
      images: inserted[0].images ?? [],
      verifiedPurchase: inserted[0].verifiedPurchase,
      createdAt: inserted[0].createdAt.toISOString(),
    };
  }

  async getUserReviewForProduct(
    productId: string,
    userId: string | undefined,
  ): Promise<ProductReview | null> {
    if (!userId) return null;
    const rows = await this.db
      .select({
        id: reviews.id,
        productId: reviews.productId,
        userId: reviews.userId,
        userName: users.name,
        rating: reviews.rating,
        content: reviews.content,
        images: reviews.images,
        sellerReply: reviews.sellerReply,
        verifiedPurchase: reviews.verifiedPurchase,
        helpfulCount: reviews.helpfulCount,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(
        and(eq(reviews.productId, productId), eq(reviews.userId, userId)),
      );
    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      productId: rows[0].productId,
      userId: rows[0].userId,
      userName: rows[0].userName,
      rating: Number(rows[0].rating),
      comment: rows[0].content ?? undefined,
      images: rows[0].images ?? [],
      sellerReply: rows[0].sellerReply ?? undefined,
      verifiedPurchase: rows[0].verifiedPurchase,
      helpfulCount: rows[0].helpfulCount,
      createdAt: rows[0].createdAt.toISOString(),
    };
  }

  async hasPurchased(productId: string, userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const rows = await this.db
      .select({ id: orderItems.id })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.productId, productId),
          eq(orders.userId, userId),
          sql`${orders.status} IN ('paid', 'shipped', 'delivered')`,
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
}
