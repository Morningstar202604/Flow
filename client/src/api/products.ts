import { http } from '../lib/http';
import type {
  Product,
  ProductListParams,
  ProductListResponse,
  CreateProductRequest,
  UpdateProductRequest,
  ImportProductsResponse,
} from '@shared/api.interface';

export async function listProducts(
  params: ProductListParams,
): Promise<ProductListResponse> {
  const { data } = await http.get<ProductListResponse>(
    '/api/products',
    { params },
  );
  return data;
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await http.get<Product>(`/api/products/${id}`);
  return data;
}

export async function getFeaturedProducts(
  limit: number = 8,
): Promise<Product[]> {
  const { data } = await http.get<Product[]>(
    '/api/products/featured',
    { params: { limit } },
  );
  return data;
}

export async function createProduct(
  payload: CreateProductRequest,
): Promise<Product> {
  const { data } = await http.post<Product>(
    '/api/products',
    payload,
  );
  return data;
}

export async function updateProduct(
  id: string,
  payload: UpdateProductRequest,
): Promise<Product> {
  const { data } = await http.patch<Product>(
    `/api/products/${id}`,
    payload,
  );
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await http.delete(`/api/products/${id}`);
}

export async function updateProductStatus(
  id: string,
  status: 'draft' | 'active' | 'inactive',
): Promise<Product> {
  return updateProduct(id, { status });
}

export async function importProducts(
  file: File,
): Promise<ImportProductsResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await http.post<ImportProductsResponse>(
    '/api/products/import',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return data;
}

export function downloadImportTemplate(): string {
  return '/api/products/import-template';
}

export async function exportProductsCsv(): Promise<Blob> {
  const { data } = await http.get('/api/products/export/csv', {
    responseType: 'blob',
  });
  return data as Blob;
}

export async function bulkUpdateProductStatus(
  ids: string[],
  status: 'draft' | 'active' | 'inactive',
): Promise<{ updated: number; failed: Array<{ id: string; reason: string }> }> {
  const { data } = await http.post('/api/products/bulk-status', { ids, status });
  return data as { updated: number; failed: Array<{ id: string; reason: string }> };
}

/** 批量按 ID 查询商品（聚合场景，仅上架商品） */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { data } = await http.get<Product[]>(`/api/products/by-ids?ids=${encodeURIComponent(ids.join(','))}`);
  return data;
}
