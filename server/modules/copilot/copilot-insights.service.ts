import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { orders, products, refunds } from '../../database/schema';
import type { CopilotInsight, CopilotInsightsView } from '../../../shared/api.interface';

/** 巡检阈值（集中定义，便于后续做成卖家可配置项） */
export const INSIGHT_THRESHOLDS = {
  lowStock: 10,
  pendingRefundHours: 48,
  unpaidOrderHours: 24,
  staleShippedDays: 14,
} as const;

/**
 * 店铺巡检：纯 SQL 聚合出的可执行告警，不调用 LLM。
 * 目的是让副驾在卖家提问前就能给出待办清单；每条告警都带一句可直接发给副驾的 prompt。
 */
@Injectable()
export class CopilotInsightsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async getInsights(): Promise<CopilotInsightsView> {
    const [lowStock, staleRefunds, unpaidOrders, staleShipments] = await Promise.all([
      this.lowStock(),
      this.staleRefunds(),
      this.unpaidOrders(),
      this.staleShipments(),
    ]);

    const insights = [...lowStock, ...staleRefunds, ...unpaidOrders, ...staleShipments].sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity),
    );

    return {
      generatedAt: new Date().toISOString(),
      thresholds: { ...INSIGHT_THRESHOLDS },
      insights,
    };
  }

  private async lowStock(): Promise<CopilotInsight[]> {
    const rows = await this.db
      .select({
        id: products.id,
        title: products.titleZh,
        totalStock: products.totalStock,
        totalSold: products.totalSold,
      })
      .from(products)
      .where(and(eq(products.status, 'active'), sql`${products.totalStock} < ${INSIGHT_THRESHOLDS.lowStock}`))
      .orderBy(asc(products.totalStock))
      .limit(10);

    return rows.map((row) => ({
      id: `low-stock-${row.id}`,
      type: 'low_stock' as const,
      severity: row.totalStock === 0 ? ('critical' as const) : ('warning' as const),
      title: row.totalStock === 0 ? '商品已售罄' : '库存偏低',
      detail: `${row.title || '未命名商品'} 当前库存 ${row.totalStock}，已售 ${row.totalSold}`,
      suggestion: `补货或下架：${row.title}`,
      prompt: `商品 ${row.title}（id=${row.id}）库存只剩 ${row.totalStock}，帮我下架并分析是否需要补货`,
      entityId: row.id,
    }));
  }

  private async staleRefunds(): Promise<CopilotInsight[]> {
    const cutoff = new Date(Date.now() - INSIGHT_THRESHOLDS.pendingRefundHours * 3600 * 1000);
    const rows = await this.db
      .select({
        id: refunds.id,
        refundNo: refunds.refundNo,
        amount: refunds.amount,
        reason: refunds.reason,
        createdAt: refunds.createdAt,
        orderNo: orders.orderNo,
      })
      .from(refunds)
      .leftJoin(orders, eq(refunds.orderId, orders.id))
      .where(and(eq(refunds.status, 'requested'), sql`${refunds.createdAt} < ${cutoff.toISOString()}`))
      .orderBy(asc(refunds.createdAt))
      .limit(10);

    return rows.map((row) => ({
      id: `refund-${row.id}`,
      type: 'stale_refund' as const,
      severity: 'critical' as const,
      title: '退款超时未处理',
      detail: `退款单 ${row.refundNo}（订单 ${row.orderNo ?? '未知'}，$${row.amount}）已等待超过 ${INSIGHT_THRESHOLDS.pendingRefundHours} 小时：${row.reason}`,
      suggestion: '尽快审批或拒绝并说明原因',
      prompt: `退款单 ${row.refundNo} 已超时，帮我查看详情并给出处理建议`,
      entityId: row.id,
    }));
  }

  private async unpaidOrders(): Promise<CopilotInsight[]> {
    const cutoff = new Date(Date.now() - INSIGHT_THRESHOLDS.unpaidOrderHours * 3600 * 1000);
    const rows = await this.db
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.status, 'pending_payment'), sql`${orders.createdAt} < ${cutoff.toISOString()}`))
      .orderBy(asc(orders.createdAt))
      .limit(10);

    return rows.map((row) => ({
      id: `unpaid-${row.id}`,
      type: 'unpaid_order' as const,
      severity: 'warning' as const,
      title: '订单超时未支付',
      detail: `订单 ${row.orderNo}（$${row.totalAmount}）创建于 ${row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}，仍未支付`,
      suggestion: '考虑取消订单释放库存',
      prompt: `订单 ${row.orderNo} 超时未支付，帮我确认后取消并释放库存`,
      entityId: row.id,
    }));
  }

  private async staleShipments(): Promise<CopilotInsight[]> {
    const cutoff = new Date(Date.now() - INSIGHT_THRESHOLDS.staleShippedDays * 24 * 3600 * 1000);
    const rows = await this.db
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        shippedAt: orders.shippedAt,
        trackingNumber: orders.trackingNumber,
      })
      .from(orders)
      .where(and(
        eq(orders.status, 'shipped'),
        gte(orders.shippedAt, sql`'1970-01-01'::timestamptz`),
        sql`${orders.shippedAt} < ${cutoff.toISOString()}`,
      ))
      .orderBy(desc(orders.shippedAt))
      .limit(10);

    return rows.map((row) => ({
      id: `stale-shipment-${row.id}`,
      type: 'stale_shipment' as const,
      severity: 'info' as const,
      title: '发货后长期未签收',
      detail: `订单 ${row.orderNo} 已发货 ${INSIGHT_THRESHOLDS.staleShippedDays} 天以上（运单 ${row.trackingNumber ?? '未填'}），仍未标记送达`,
      suggestion: '核对物流后标记送达或联系买家',
      prompt: `订单 ${row.orderNo} 发货超过 ${INSIGHT_THRESHOLDS.staleShippedDays} 天，帮我核对物流状态`,
      entityId: row.id,
    }));
  }
}

function severityRank(severity: CopilotInsight['severity']): number {
  return severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2;
}
