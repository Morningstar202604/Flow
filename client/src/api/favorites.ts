import { http } from '../lib/http';
import type { FavoriteProduct } from '@shared/api.interface';

export async function getMyFavorites(): Promise<FavoriteProduct[]> {
  const { data } = await http.get<FavoriteProduct[]>(
    '/api/favorites',
  );
  return data;
}

export async function toggleFavorite(
  productId: string,
): Promise<{ favorited: boolean; id?: string }> {
  const { data } = await http.post<{ favorited: boolean; id?: string }>(
    `/api/favorites/${productId}`,
    {},
  );
  return data;
}

export async function checkFavoriteBatch(
  productIds: string[],
): Promise<string[]> {
  const { data } = await http.get<{ favoritedIds: string[] }>(
    `/api/favorites/check-batch?productIds=${productIds.join(',')}`,
  );
  return data.favoritedIds || [];
}

export async function checkFavorite(productId: string): Promise<{ favorited: boolean }> {
  const { data } = await http.get<{ favorited: boolean }>(
    `/api/favorites/check/${productId}`,
  );
  return data;
}
