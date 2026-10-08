import { http } from '../lib/http';
// logger removed (was lark-specific)
import type { Category } from '@shared/api.interface';

export async function listCategories(): Promise<Category[]> {
  console.info('[categories] list');
  const { data } = await http.get<Category[]>('/api/categories');
  return data;
}

export async function createCategory(
  payload: Omit<Category, 'id' | 'sortOrder'> & { sortOrder?: number },
): Promise<Category> {
  console.info('[categories] create', payload.nameZh);
  const { data } = await http.post<Category>(
    '/api/categories',
    payload,
  );
  return data;
}

export async function updateCategory(
  id: string,
  payload: Partial<Category>,
): Promise<Category> {
  console.info('[categories] update', id);
  const { data } = await http.patch<Category>(
    `/api/categories/${id}`,
    payload,
  );
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  console.info('[categories] delete', id);
  await http.delete(`/api/categories/${id}`);
}
