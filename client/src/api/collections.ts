import { http } from '../lib/http';
import type {
  Collection,
  CollectionListResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  StorefrontSection,
} from '@shared/api.interface';

export async function getCollections(): Promise<Collection[]> {
  const { data } = await http.get<CollectionListResponse>('/api/collections');
  return data.items;
}

export async function getFeaturedCollections(): Promise<Collection[]> {
  const { data } = await http.get<Collection[]>('/api/collections/featured');
  return data;
}

export async function getCollectionDetail(id: string): Promise<Collection> {
  const { data } = await http.get<Collection>(`/api/collections/${id}`);
  return data;
}

/** 按 slug 获取集合详情（买家端公开） */
export async function getCollectionBySlug(slug: string): Promise<Collection & { products: Array<{ productId: string }> }> {
  const { data } = await http.get(`/api/collections/by-slug/${encodeURIComponent(slug)}`);
  return data;
}

export async function createCollection(payload: CreateCollectionRequest): Promise<Collection> {
  const { data } = await http.post<Collection>('/api/collections', payload);
  return data;
}

export async function updateCollection(id: string, payload: UpdateCollectionRequest): Promise<Collection> {
  const { data } = await http.put<Collection>(`/api/collections/${id}`, payload);
  return data;
}

export async function deleteCollection(id: string): Promise<void> {
  await http.delete(`/api/collections/${id}`);
}

export async function addProductToCollection(collectionId: string, productId: string): Promise<Collection> {
  const { data } = await http.post<Collection>(`/api/collections/${collectionId}/products`, { productId });
  return data;
}

export async function removeProductFromCollection(collectionId: string, productId: string): Promise<void> {
  await http.delete(`/api/collections/${collectionId}/products/${productId}`);
}

export async function reorderCollectionProducts(collectionId: string, productIds: string[]): Promise<Collection> {
  const { data } = await http.put<Collection>(`/api/collections/${collectionId}/products/reorder`, { productIds });
  return data;
}

/** 店铺楼层（首页）：精选集合 + 集合内商品 */
export async function getStorefront(): Promise<StorefrontSection[]> {
  const { data } = await http.get<StorefrontSection[]>('/api/collections/storefront');
  return data;
}
