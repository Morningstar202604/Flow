import { http } from '../lib/http';
import type { DashboardData } from '@shared/api.interface';

export const getDashboardStats = async (): Promise<DashboardData> => {
  const { data } = await http.get<DashboardData>(
    '/api/dashboard/stats',
  );
  return data;
};
