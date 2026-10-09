import { http } from '../lib/http';
import { getSessionId } from '@/utils/session';
import type {
  Refund,
  RefundListResponse,
  RefundListParams,
  CreateRefundRequest,
  RefundActionRequest,
} from '@shared/api.interface';

function buyerHeaders(): Record<string, string> {
  return { 'x-session-id': getSessionId() };
}

/** Buyer: Get my refunds */
export async function getMyRefunds(params: RefundListParams = {}): Promise<RefundListResponse> {
  const { data } = await http.get<RefundListResponse>('/api/my/refunds', {
    params,
    headers: buyerHeaders(),
  });
  return data;
}

/** Buyer: Get my refund detail */
export async function getMyRefundDetail(id: string): Promise<Refund> {
  const { data } = await http.get<Refund>(`/api/my/refunds/${id}`, {
    headers: buyerHeaders(),
  });
  return data;
}

/** Buyer: Create refund request */
export async function createRefund(payload: CreateRefundRequest): Promise<Refund> {
  const { data } = await http.post<Refund>(
    `/api/orders/${payload.orderId}/refunds`,
    payload,
    { headers: buyerHeaders() },
  );
  return data;
}

/** Seller: Get all refunds */
export async function getSellerRefunds(params: RefundListParams = {}): Promise<RefundListResponse> {
  const { data } = await http.get<RefundListResponse>('/api/refunds', { params });
  return data;
}

/** Seller: Get refund detail */
export async function getRefundDetail(id: string): Promise<Refund> {
  const { data } = await http.get<Refund>(`/api/refunds/${id}`);
  return data;
}

/** Seller: Approve refund */
export async function approveRefund(id: string, payload?: RefundActionRequest): Promise<Refund> {
  const { data } = await http.post<Refund>(`/api/refunds/${id}/approve`, payload);
  return data;
}

/** Seller: Reject refund */
export async function rejectRefund(id: string, payload: RefundActionRequest): Promise<Refund> {
  const { data } = await http.post<Refund>(`/api/refunds/${id}/reject`, payload);
  return data;
}
