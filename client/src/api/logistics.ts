import { http } from '../lib/http';
import type {
  LogisticsTracking,
  CreateLogisticsRequest,
} from '@shared/api.interface';

export async function getLogistics(
  orderId: string,
): Promise<LogisticsTracking> {
  console.info('[logistics] get', orderId);
  const { data } = await http.get<LogisticsTracking>(
    `/api/logistics/${orderId}`,
  );
  return data;
}

export async function createLogistics(
  payload: CreateLogisticsRequest,
): Promise<LogisticsTracking> {
  console.info('[logistics] create', payload.orderId, payload.carrier);
  const { data } = await http.post<LogisticsTracking>(
    '/api/logistics',
    payload,
  );
  return data;
}
