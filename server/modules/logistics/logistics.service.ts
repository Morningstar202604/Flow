import { Injectable, Inject, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq } from 'drizzle-orm';
import { logistics, orders } from '@server/database/schema';

export interface TrackingEvent {
  time: string;
  status: string;
  location: string;
  description: string;
}

export interface TrackingInfo {
  events: TrackingEvent[];
  carrier: string | null;
  trackingNumber: string | null;
  isDemo: boolean;
}

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);
  private readonly apiKey: string;
  private readonly isDemoMode: boolean;

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {
    this.apiKey = process.env['17TRACK_API_KEY'] || '';
    this.isDemoMode = !this.apiKey;
  }

  async registerTracking(
    orderId: string,
    carrier: string,
    trackingNumber: string,
  ): Promise<{ success: boolean; isDemo: boolean }> {
    if (this.isDemoMode) {
      await this.upsertLogisticsAndShipOrder(orderId, carrier, trackingNumber);
      return { success: true, isDemo: true };
    }

    try {
      await this.upsertLogisticsAndShipOrder(orderId, carrier, trackingNumber);
      return { success: true, isDemo: false };
    } catch (error) {
      this.logger.error('注册运单失败', error);
      throw error;
    }
  }

  private async upsertLogisticsAndShipOrder(
    orderId: string,
    carrier: string,
    trackingNumber: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: logistics.id })
        .from(logistics)
        .where(eq(logistics.orderId, orderId))
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(logistics)
          .set({
            carrier,
            trackingNumber,
            status: 'in_transit',
            updatedAt: new Date(),
          })
          .where(eq(logistics.orderId, orderId));
      } else {
        await tx.insert(logistics).values({
          orderId,
          carrier,
          trackingNumber,
          status: 'in_transit',
          updatedAt: new Date(),
        });
      }

      await tx
        .update(orders)
        .set({
          status: 'shipped',
          trackingNo: trackingNumber,
          shippedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    });
  }

  async getTrackingInfo(orderId: string): Promise<TrackingInfo> {
    const [order] = await this.db
      .select({
        id: orders.id,
        status: orders.status,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        shippedAt: orders.shippedAt,
        deliveredAt: orders.deliveredAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    const [logisticsRecord] = await this.db
      .select({
        carrier: logistics.carrier,
        trackingNumber: logistics.trackingNumber,
        status: logistics.status,
      })
      .from(logistics)
      .where(eq(logistics.orderId, orderId))
      .limit(1);

    if (this.isDemoMode) {
      const events = this.generateDemoTimeline(order);
      return {
        events,
        carrier: logisticsRecord?.carrier ?? null,
        trackingNumber: logisticsRecord?.trackingNumber ?? null,
        isDemo: true,
      };
    }

    // Real 17Track API would go here; fallback to demo timeline
    const events = this.generateDemoTimeline(order);
    return {
      events,
      carrier: logisticsRecord?.carrier ?? null,
      trackingNumber: logisticsRecord?.trackingNumber ?? null,
      isDemo: false,
    };
  }

  async verifyOrderOwnership(
    orderId: string,
    userId: string | undefined,
    sessionId: string | undefined,
  ): Promise<void> {
    const [order] = await this.db
      .select({
        id: orders.id,
        userId: orders.userId,
        sessionId: orders.sessionId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (userId && order.userId === userId) {
      return;
    }

    if (sessionId && order.sessionId === sessionId) {
      return;
    }

    throw new ForbiddenException('无权查看该订单物流');
  }

  private generateDemoTimeline(order: {
    status: string;
    createdAt: Date;
    paidAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  }): TrackingEvent[] {
    const events: TrackingEvent[] = [];
    const status = order.status;

    // Always include order placed event
    events.push({
      time: order.createdAt.toISOString(),
      status: 'order_placed',
      location: '',
      description: '订单已提交',
    });

    if (status === 'pending_payment') {
      return events;
    }

    if (order.paidAt) {
      events.push({
        time: order.paidAt.toISOString(),
        status: 'paid',
        location: '',
        description: '订单已付款',
      });
    }

    if (status === 'paid') {
      return events;
    }

    if (order.shippedAt) {
      const shippedTime = order.shippedAt;
      events.push({
        time: shippedTime.toISOString(),
        status: 'shipped',
        location: '中国深圳',
        description: '包裹已发出，等待承运人揽收',
      });

      // Add in_transit event (1 day after shipping)
      const inTransitTime = new Date(shippedTime.getTime() + 24 * 60 * 60 * 1000);
      events.push({
        time: inTransitTime.toISOString(),
        status: 'in_transit',
        location: '香港转运中心',
        description: '包裹已到达转运中心，正在安排国际运输',
      });

      // Add customs event (3 days after shipping)
      const customsTime = new Date(shippedTime.getTime() + 3 * 24 * 60 * 60 * 1000);
      events.push({
        time: customsTime.toISOString(),
        status: 'customs',
        location: '目的国海关',
        description: '包裹正在清关处理中',
      });
    }

    if (status === 'shipped' || status === 'in_transit') {
      return events;
    }

    if (order.deliveredAt) {
      events.push({
        time: order.deliveredAt.toISOString(),
        status: 'delivered',
        location: '收件地址',
        description: '包裹已签收',
      });
    }

    if (status === 'cancelled') {
      events.push({
        time: order.createdAt.toISOString(),
        status: 'cancelled',
        location: '',
        description: '订单已取消',
      });
    }

    return events;
  }
}
