import { http } from '../lib/http';
import type {
  Collection,
  CollectionListResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
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
