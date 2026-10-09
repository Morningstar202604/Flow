import { http } from '../lib/http';
import type { Category } from '@shared/api.interface';

export async function listCategories(): Promise<Category[]> {
  const { data } = await http.get<Category[]>('/api/categories');
  return data;
}
