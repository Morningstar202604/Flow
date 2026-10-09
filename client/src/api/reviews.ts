import { http } from '../lib/http';
import type {
  ProductReview,
  ProductReviewsResponse,
  CreateReviewRequest,
} from '@shared/api.interface';

export async function getProductReviews(
  productId: string,
): Promise<ProductReviewsResponse> {
  const { data } = await http.get<ProductReviewsResponse>(
    `/api/products/${productId}/reviews`,
  );
  return data;
}

export async function getMyReview(
  productId: string,
): Promise<{ review: ProductReview | null; hasPurchased: boolean }> {
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
  const { data } = await http.post<ProductReview>(
    `/api/products/${productId}/reviews`,
    body,
  );
  return data;
}
