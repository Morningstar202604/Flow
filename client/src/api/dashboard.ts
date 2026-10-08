import { http } from '../lib/http';
import type { DashboardData } from '@shared/api.interface';

export const getDashboardStats = async (): Promise<DashboardData> => {
  console.info('获取看板统计数据');
  const { data } = await http.get<DashboardData>(
    '/api/dashboard/stats',
  );
  return data;
};
