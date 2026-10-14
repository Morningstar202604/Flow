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

export interface ShippingQuoteResponse {
  fee: string;
  templateId: string | null;
}

/** 买家结算页运费报价（展示用；下单时服务端重算并以订单为准） */
export async function getShippingQuote(params: {
  subtotal: number;
  qtyTotal?: number;
  weightTotal?: number;
  country?: string;
}): Promise<ShippingQuoteResponse> {
  const qs = new URLSearchParams();
  qs.set('subtotal', params.subtotal.toFixed(2));
  if (params.qtyTotal !== undefined) qs.set('qtyTotal', String(params.qtyTotal));
  if (params.weightTotal !== undefined) qs.set('weightTotal', String(params.weightTotal));
  if (params.country) qs.set('country', params.country);
  const { data } = await http.get<ShippingQuoteResponse>(`/api/shipping/quote?${qs.toString()}`);
  return data;
}

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
