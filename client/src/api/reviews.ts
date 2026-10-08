import { http } from '../lib/http';
import type {
  ProductReview,
  ProductReviewsResponse,
  CreateReviewRequest,
} from '@shared/api.interface';

export async function getProductReviews(
  productId: string,
): Promise<ProductReviewsResponse> {
  console.info('[reviews] list', productId);
  const { data } = await http.get<ProductReviewsResponse>(
    `/api/products/${productId}/reviews`,
  );
  return data;
}

export async function getMyReview(
  productId: string,
): Promise<{ review: ProductReview | null; hasPurchased: boolean }> {
  console.info('[reviews] my', productId);
  const { data } = await http.get<{
    review: ProductReview | null;
    hasPurchased: boolean;
  }>(`/api/products/${productId}/reviews/my`);
  return data;
}

export async function createReview(
  productId: string,
  body: CreateReviewRequest,
): Promise<ProductReview> {
  console.info('[reviews] create', productId);
  const { data } = await http.post<ProductReview>(
    `/api/products/${productId}/reviews`,
    body,
  );
  return data;
}
