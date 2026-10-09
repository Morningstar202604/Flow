import { http } from '../lib/http';
import type {
  CmsPage,
  CmsPageListParams,
  CmsPageListResponse,
  CreateCmsPageRequest,
  UpdateCmsPageRequest,
} from '@shared/api.interface';

export async function getCmsPages(params: CmsPageListParams = {}): Promise<CmsPageListResponse> {
  const { data } = await http.get<CmsPageListResponse>('/api/cms/pages', { params });
  return data;
}

export async function getCmsPageDetail(id: string): Promise<CmsPage> {
  const { data } = await http.get<CmsPage>(`/api/cms/pages/${id}`);
  return data;
}

export async function createCmsPage(payload: CreateCmsPageRequest): Promise<CmsPage> {
  const { data } = await http.post<CmsPage>('/api/cms/pages', payload);
  return data;
}

export async function updateCmsPage(id: string, payload: UpdateCmsPageRequest): Promise<CmsPage> {
  const { data } = await http.put<CmsPage>(`/api/cms/pages/${id}`, payload);
  return data;
}

export async function deleteCmsPage(id: string): Promise<void> {
  await http.delete(`/api/cms/pages/${id}`);
}

/** Public: get page by slug (no auth) */
export async function getPageBySlug(slug: string): Promise<CmsPage> {
  const { data } = await http.get<CmsPage>(`/api/pages/${slug}`);
  return data;
}
