import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database,
} from '../../database/database.provider';
import { sql } from 'drizzle-orm';
import {
  products,
  visits,
} from '../../database/schema';
import type {
  DashboardData,
  DashboardStats,
  SalesTrendItem,
  CategorySalesItem,
} from '../../../shared/api.interface';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
  ) {}

  async getStats(actor?: { sellerId?: string; role?: string }): Promise<DashboardData> {
    // 卖家只看本店；管理员（无 sellerId 过滤）看全平台
    const sellerId = actor && actor.role !== 'admin' ? actor.sellerId : undefined;
    const [statsResult, salesTrend, categorySales] = await Promise.all([
      this.getDashboardStats(sellerId),
      this.getSalesTrend(sellerId),
      this.getCategorySales(sellerId),
    ]);

    return {
      stats: statsResult,
      salesTrend,
      categorySales,
    };
  }

  private async getDashboardStats(sellerId?: string): Promise<DashboardStats> {
    const todayStart = this.getTodayStartIso();
    const windowStart = this.getDaysAgoStartIso(90);

    const result = await this.db.execute<{
      gmv: string;
      order_count: string;
      visitor_count: string;
      product_count: string;
      today_gmv: string;
      today_orders: string;
      pending_orders: string;
    }>(sql`
      SELECT
        COALESCE(SUM(CASE WHEN o.status IN ('paid', 'shipped', 'delivered') THEN o.total_amount ELSE 0 END), 0)::text AS gmv,
        COALESCE(COUNT(o.id), 0)::text AS order_count,
        (SELECT COUNT(DISTINCT ${visits.sessionId}) FROM ${visits} WHERE ${visits.createdAt} >= ${windowStart}::timestamptz)::text AS visitor_count,
        (SELECT COUNT(${products.id}) FROM ${products}
          ${sellerId ? sql`WHERE ${products.sellerId} = ${sellerId}` : sql``})::text AS product_count,
        COALESCE(SUM(CASE WHEN o.status IN ('paid', 'shipped', 'delivered') AND o.created_at >= ${todayStart}::timestamptz THEN o.total_amount ELSE 0 END), 0)::text AS today_gmv,
        COALESCE(COUNT(CASE WHEN o.created_at >= ${todayStart}::timestamptz THEN 1 END), 0)::text AS today_orders,
        COALESCE(COUNT(CASE WHEN o.status = 'paid' THEN 1 END), 0)::text AS pending_orders
      FROM orders o
      WHERE o.created_at >= ${windowStart}::timestamptz
        ${sellerId ? sql`AND o.seller_id = ${sellerId}` : sql``}
    `);

    const row = result[0] as {
      gmv: string;
      order_count: string;
      visitor_count: string;
      product_count: string;
      today_gmv: string;
      today_orders: string;
      pending_orders: string;
    } | undefined;
    if (!row) {
      return {
        gmv: '0',
        orderCount: 0,
        visitorCount: 0,
        productCount: 0,
        todayGmv: '0',
        todayOrders: 0,
        pendingOrders: 0,
      };
    }

    return {
      gmv: row.gmv,
      orderCount: parseInt(row.order_count, 10),
      visitorCount: parseInt(row.visitor_count, 10),
      productCount: parseInt(row.product_count, 10),
      todayGmv: row.today_gmv,
      todayOrders: parseInt(row.today_orders, 10),
      pendingOrders: parseInt(row.pending_orders, 10),
    };
  }

  private async getSalesTrend(sellerId?: string): Promise<SalesTrendItem[]> {
    const result = await this.db.execute<{
      date: string;
      amount: string;
      orders: string;
    }>(sql`
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(o.total_amount), 0)::text AS amount,
        COALESCE(COUNT(o.id), 0)::text AS orders
      FROM (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '29 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS day
      ) d
       LEFT JOIN orders o
         ON DATE(o.created_at AT TIME ZONE 'Asia/Shanghai') = d.day
         AND o.status IN ('paid', 'shipped', 'delivered')
         AND o.created_at >= (CURRENT_DATE - INTERVAL '29 days')
         ${sellerId ? sql`AND o.seller_id = ${sellerId}` : sql``}
       GROUP BY d.day
      ORDER BY d.day ASC
    `);

    return result.map((row: { date: string; amount: string; orders: string }) => ({
      date: row.date,
      amount: parseFloat(row.amount),
      orders: parseInt(row.orders, 10),
    }));
  }

  private async getCategorySales(sellerId?: string): Promise<CategorySalesItem[]> {
    const result = await this.db.execute<{
      name: string;
      amount: string;
    }>(sql`
      SELECT
        COALESCE(c.name_zh, '未分类') AS name,
        SUM(oi.subtotal)::text AS amount
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.status IN ('paid', 'shipped', 'delivered')
        AND o.created_at >= (CURRENT_DATE - INTERVAL '89 days')
        ${sellerId ? sql`AND o.seller_id = ${sellerId}` : sql``}
      GROUP BY c.name_zh
      ORDER BY SUM(oi.subtotal) DESC
    `);

    if (result.length === 0) {
      return [];
    }

    const totalAmount = result.reduce(
      (sum: number, row: { amount: string }) => sum + parseFloat(row.amount),
      0,
    );

    // 前5个保留，其余归为"其他"
    const top5 = result.slice(0, 5);
    const rest = result.slice(5);

    const items: CategorySalesItem[] = top5.map(
      (row: { name: string; amount: string }) => ({
        name: row.name,
        amount: parseFloat(row.amount),
        percentage:
          totalAmount > 0
            ? Math.round((parseFloat(row.amount) / totalAmount) * 1000) / 10
            : 0,
      }),
    );

    if (rest.length > 0) {
      const restAmount = rest.reduce(
        (sum: number, row: { amount: string }) => sum + parseFloat(row.amount),
        0,
      );
      items.push({
        name: '其他',
        amount: restAmount,
        percentage:
          totalAmount > 0
            ? Math.round((restAmount / totalAmount) * 1000) / 10
            : 0,
      });
    }

    return items;
  }

  private getDaysAgoStartIso(days: number): string {
    const now = new Date();
    const shanghaiOffset = 8 * 60;
    const utcMinutes = now.getTime() / 60000 + now.getTimezoneOffset();
    const shanghaiMinutes = utcMinutes + shanghaiOffset;
    const dayStartShanghaiMinutes =
      Math.floor(shanghaiMinutes / 1440) * 1440 - shanghaiOffset - days * 1440;
    return new Date(dayStartShanghaiMinutes * 60000).toISOString();
  }

  private getTodayStartIso(): string {
    const now = new Date();
    // 按 Asia/Shanghai 时区计算今日零点
    const shanghaiOffset = 8 * 60; // UTC+8
    const utcMinutes = now.getTime() / 60000 + now.getTimezoneOffset();
    const shanghaiMinutes = utcMinutes + shanghaiOffset;
    const todayStartShanghaiMinutes =
      Math.floor(shanghaiMinutes / 1440) * 1440 - shanghaiOffset;
    const todayStart = new Date(todayStartShanghaiMinutes * 60000);
    return todayStart.toISOString();
  }
}
