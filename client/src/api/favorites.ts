import { http } from '../lib/http';
// logger removed (was lark-specific)
import type { FavoriteProduct } from '@shared/api.interface';

export async function getMyFavorites(): Promise<FavoriteProduct[]> {
  console.info('[favorites] list');
  const { data } = await http.get<FavoriteProduct[]>(
    '/api/favorites',
  );
  return data;
}

export async function toggleFavorite(
  productId: string,
): Promise<{ favorited: boolean; id?: string }> {
  console.info('[favorites] toggle', productId);
  const { data } = await http.post<{ favorited: boolean; id?: string }>(
    `/api/favorites/${productId}`,
    {},
  );
  return data;
}

export async function checkFavoriteBatch(
  productIds: string[],
): Promise<string[]> {
  console.info('[favorites] check batch', productIds.length);
  const { data } = await http.get<{ favoritedIds: string[] }>(
    `/api/favorites/check-batch?productIds=${productIds.join(',')}`,
  );
  return data.favoritedIds || [];
}

export async function checkFavorite(productId: string): Promise<{ favorited: boolean }> {
  console.info('[favorites] check', productId);
  const { data } = await http.get<{ favorited: boolean }>(
    `/api/favorites/check/${productId}`,
  );
  return data;
}
