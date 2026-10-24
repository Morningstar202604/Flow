import { http } from '../lib/http';
import { getSessionId } from '@/utils/session';
import type { PayRequest, PayResponse } from '@shared/api.interface';

function buyerHeaders(): Record<string, string> {
  return { 'x-session-id': getSessionId() };
}

export async function payForOrder(body: PayRequest): Promise<PayResponse> {
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
  stripePublishableKey?: string;
}> {
  const { data } = await http.get<{
    stripeConfigured: boolean;
    paypalConfigured: boolean;
    demoMode: boolean;
    stripePublishableKey?: string;
  }>('/api/payments/config');
  return data;
}
