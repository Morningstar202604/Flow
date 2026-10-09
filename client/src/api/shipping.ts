import { http } from '../lib/http';
import type {
  ShippingTemplate,
  ShippingRule,
  CreateShippingTemplateRequest,
  UpdateShippingTemplateRequest,
  ShippingCalculateRequest,
  ShippingCalculateResponse,
} from '@shared/api.interface';

export type { ShippingRule };

export async function getShippingTemplates(): Promise<ShippingTemplate[]> {
  const { data } = await http.get<ShippingTemplate[]>('/api/shipping-templates');
  return data;
}

export async function getShippingTemplate(id: string): Promise<ShippingTemplate> {
  const { data } = await http.get<ShippingTemplate>(`/api/shipping-templates/${id}`);
  return data;
}

export async function createShippingTemplate(payload: CreateShippingTemplateRequest): Promise<ShippingTemplate> {
  const { data } = await http.post<ShippingTemplate>('/api/shipping-templates', payload);
  return data;
}

export async function updateShippingTemplate(id: string, payload: UpdateShippingTemplateRequest): Promise<ShippingTemplate> {
  const { data } = await http.put<ShippingTemplate>(`/api/shipping-templates/${id}`, payload);
  return data;
}

export async function deleteShippingTemplate(id: string): Promise<void> {
  await http.delete(`/api/shipping-templates/${id}`);
}

export async function calculateShipping(payload: ShippingCalculateRequest): Promise<ShippingCalculateResponse> {
  const { data } = await http.post<ShippingCalculateResponse>('/api/shipping-templates/calculate', payload);
  return data;
}
