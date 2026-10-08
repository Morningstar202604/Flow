import { http } from '../lib/http';
import type { AuditLogListResponse, AuditLogQuery } from '@shared/api.interface';

export async function getAuditLogs(params?: AuditLogQuery): Promise<AuditLogListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page !== undefined) queryParams.set('page', String(params.page));
  if (params?.pageSize !== undefined) queryParams.set('pageSize', String(params.pageSize));
  if (params?.action) queryParams.set('action', params.action);
  if (params?.startDate) queryParams.set('startDate', params.startDate);
  if (params?.endDate) queryParams.set('endDate', params.endDate);

  const query = queryParams.toString();
  const url = query ? `/api/audit-logs?${query}` : '/api/audit-logs';

  const response = await http.get(url);
  return response.data;
}
