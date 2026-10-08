import { http } from '../lib/http';
import { getSessionId } from '@/utils/session';
import type { PayRequest, PayResponse, Payment } from '@shared/api.interface';

function buyerHeaders(): Record<string, string> {
  return { 'x-session-id': getSessionId() };
}

export async function payForOrder(body: PayRequest): Promise<PayResponse> {
  console.info('[payments] pay', body.orderId, body.provider);
  const { data } = await http.post<PayResponse>(
    '/api/payments/pay',
    body,
    { headers: buyerHeaders() },
  );
  return data;
}

export async function getPaymentConfig(): Promise<{
  stripeConfigured: boolean;
  paypalConfigured: boolean;
  demoMode: boolean;
}> {
  console.info('[payments] config');
  const { data } = await http.get<{
    stripeConfigured: boolean;
    paypalConfigured: boolean;
    demoMode: boolean;
  }>('/api/payments/config');
  return data;
}

export async function getPaymentsByOrder(orderId: string): Promise<Payment[]> {
  console.info('[payments] by order', orderId);
  const { data } = await http.get<Payment[]>(
    `/api/payments/order/${orderId}`,
    { headers: buyerHeaders() },
  );
  return data;
}
