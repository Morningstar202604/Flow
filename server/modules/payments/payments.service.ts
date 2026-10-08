import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, desc } from 'drizzle-orm';

import { payments, orders, orderItems } from '@server/database/schema';
import type {
  Payment,
  PaymentProvider,
  PaymentStatus,
  PayResponse,
  Order,
} from '@shared/api.interface';

import { StripeService } from './stripe.service';
import { PayPalService } from './paypal.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly stripeService: StripeService,
    private readonly payPalService: PayPalService,
    private readonly auditService: AuditService,
  ) {}

  private generateDemoTransactionId(): string {
    return `DEMO_${Date.now().toString()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }

  private mapPayment(row: {
    id: string;
    orderId: string;
    provider: string;
    amount: string;
    currency: string;
    status: string;
    transactionId: string | null;
    createdAt: Date;
  }): Payment {
    return {
      id: row.id,
      orderId: row.orderId,
      provider: row.provider as PaymentProvider,
      amount: row.amount,
      currency: row.currency,
      status: row.status as PaymentStatus,
      transactionId: row.transactionId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async pay(
    orderId: string,
    provider: PaymentProvider,
    userId?: string,
    sessionId?: string,
    auditMeta?: { ip?: string },
  ): Promise<PayResponse> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];
    const isOwner = (userId && order.userId && order.userId === userId)
      || (sessionId && order.sessionId && order.sessionId === sessionId);
    if (!isOwner) {
      throw new ForbiddenException('无权支付该订单');
    }
    if (order.status === 'paid') {
      throw new BadRequestException('订单已支付');
    }
    if (order.status !== 'pending_payment') {
      throw new BadRequestException('当前订单状态无法支付');
    }

    const amount = Number(order.totalAmount);
    const currency = 'USD';

    if (provider === 'stripe' && this.stripeService.isConfigured()) {
      const { clientSecret, paymentIntentId } = await this.stripeService.createPaymentIntent(
        amount,
        currency,
        orderId,
      );
      const paymentRow = await this.createPayment(orderId, 'stripe', amount, currency, 'pending', paymentIntentId);
      return {
        success: true,
        payment: this.mapPayment({
          ...paymentRow,
          createdAt: new Date(paymentRow.createdAt),
        }),
        message: 'Stripe payment intent created',
      };
    }

    if (provider === 'paypal' && this.payPalService.isConfigured()) {
      const { paypalOrderId, approveUrl } = await this.payPalService.createOrder(
        amount,
        currency,
        orderId,
      );
      const paymentRow = await this.createPayment(orderId, 'paypal', amount, currency, 'pending', paypalOrderId);
      return {
        success: true,
        payment: this.mapPayment({
          ...paymentRow,
          createdAt: new Date(paymentRow.createdAt),
        }),
        message: approveUrl,
      };
    }

    return this.processDemoPayment(orderId, provider, amount, currency, order, auditMeta);
  }

  private async processDemoPayment(
    orderId: string,
    provider: PaymentProvider,
    amount: number,
    currency: string,
    order: typeof orders.$inferSelect,
    auditMeta?: { ip?: string },
  ): Promise<PayResponse> {
    const transactionId = this.generateDemoTransactionId();

    const result = await this.db.transaction(async (tx) => {
      const paymentRows = await tx
        .insert(payments)
        .values({
          orderId,
          method: provider,
          provider,
          amount: amount.toString(),
          currency,
          status: 'paid',
          transactionId,
        })
        .returning();

      const now = new Date();
      const updatedOrders = await tx
        .update(orders)
        .set({
          status: 'paid',
          paidAt: now,
          paymentMethod: provider,
        })
        .where(eq(orders.id, orderId))
        .returning();

      return { payment: paymentRows[0], order: updatedOrders[0] };
    });

    this.logger.log(
      `Demo payment successful: order=${order.orderNo} provider=${provider} txn=${transactionId} amount=${amount}`,
    );

    // Audit log for payment
    try {
      void this.auditService.log({
        action: 'payment.pay',
        entity: 'payment',
        entityId: result.payment.id,
        after: {
          amount: result.payment.amount,
          provider,
          status: 'paid',
        },
        userId: order.userId ?? undefined,
        role: order.userId ? 'buyer' : undefined,
        ip: auditMeta?.ip,
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    const updatedOrder = result.order;
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const orderResponse: Order = {
      id: updatedOrder.id,
      orderNo: updatedOrder.orderNo,
      userId: updatedOrder.userId,
      buyerName: updatedOrder.buyerName ?? '',
      buyerEmail: updatedOrder.buyerEmail ?? undefined,
      buyerPhone: updatedOrder.buyerPhone ?? undefined,
      shippingAddress: updatedOrder.shippingAddress,
      shippingCity: updatedOrder.shippingCity,
      shippingZip: updatedOrder.shippingZip ?? undefined,
      shippingCountry: updatedOrder.shippingCountry,
      totalAmount: updatedOrder.totalAmount,
      status: updatedOrder.status as Order['status'],
      paymentMethod: updatedOrder.paymentMethod ?? provider,
      paidAt: updatedOrder.paidAt?.toISOString(),
      shippedAt: updatedOrder.shippedAt?.toISOString(),
      deliveredAt: updatedOrder.deliveredAt?.toISOString(),
      trackingNo: updatedOrder.trackingNo ?? undefined,
      remark: updatedOrder.remark ?? undefined,
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId ?? undefined,
        productTitle: item.productTitle,
        productImage: item.productImage ?? undefined,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
      createdAt: updatedOrder.createdAt.toISOString(),
      updatedAt: updatedOrder.updatedAt.toISOString(),
    };

    return {
      success: true,
      payment: this.mapPayment({
        ...result.payment,
        createdAt: new Date(result.payment.createdAt),
      }),
      order: orderResponse,
      demoMode: true,
      message: '演示支付成功',
    };
  }

  private async createPayment(
    orderId: string,
    provider: PaymentProvider,
    amount: number,
    currency: string,
    status: PaymentStatus,
    transactionId?: string,
  ): Promise<typeof payments.$inferSelect> {
    const rows = await this.db
      .insert(payments)
      .values({
        orderId,
        method: provider,
        provider,
        amount: amount.toString(),
        currency,
        status,
        transactionId,
      })
      .returning();
    return rows[0];
  }

  async getPaymentsByOrder(
    orderId: string,
    userId?: string,
    sessionId?: string,
    isSeller = false,
  ): Promise<Payment[]> {
    if (!isSeller) {
      const orderRows = await this.db.select().from(orders).where(eq(orders.id, orderId));
      if (orderRows.length === 0) {
        throw new NotFoundException('订单不存在');
      }
      const order = orderRows[0];
      const isOwner = (userId && order.userId && order.userId === userId)
        || (sessionId && order.sessionId && order.sessionId === sessionId);
      if (!isOwner) {
        throw new ForbiddenException('无权查看该订单的支付记录');
      }
    }

    const rows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));

    return rows.map((row) =>
      this.mapPayment({
        ...row,
        createdAt: new Date(row.createdAt),
      }),
    );
  }

  async getPaymentConfig(): Promise<{
    stripeConfigured: boolean;
    paypalConfigured: boolean;
    demoMode: boolean;
  }> {
    const stripeConfigured = this.stripeService.isConfigured();
    const paypalConfigured = this.payPalService.isConfigured();
    return {
      stripeConfigured,
      paypalConfigured,
      demoMode: !stripeConfigured && !paypalConfigured,
    };
  }

  async handlePayPalWebhook(
    headers: Record<string, string>,
    body: any,
  ): Promise<boolean> {
    const verified = await this.payPalService.verifyWebhook(
      headers,
      JSON.stringify(body),
    );
    if (!verified) {
      return false;
    }

    const { eventType, data } = verified;
    if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
      this.logger.log(`PayPal webhook skipped: ${eventType}`);
      return true;
    }

    const orderId = (data as Record<string, any>)?.custom_id;
    const transactionId = (data as Record<string, any>)?.id;
    const amount = (data as Record<string, any>)?.amount?.value;
    const currency = (data as Record<string, any>)?.amount?.currency_code ?? 'USD';

    if (!orderId) {
      this.logger.warn('PayPal webhook rejected: missing custom_id (orderId)');
      return false;
    }

    try {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(payments)
          .values({
            orderId,
            method: 'paypal',
            provider: 'paypal',
            amount: amount?.toString() ?? '0',
            currency,
            status: 'paid',
            transactionId: transactionId ?? null,
          });
        await tx
          .update(orders)
          .set({
            status: 'paid',
            paidAt: new Date(),
            paymentMethod: 'paypal',
          })
          .where(eq(orders.id, orderId));
      });
      return true;
    } catch (err) {
      this.logger.error('PayPal webhook order update failed', (err as Error).message);
      return false;
    }
  }
}
