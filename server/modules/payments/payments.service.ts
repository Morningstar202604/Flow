import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc, or, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { payments, orders, orderItems, refunds } from '@server/database/schema';
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

  /** Parse addressSnapshot JSON for output mapping */
  private parseAddressSnapshot(raw: string | null): {
    receiverName?: string;
    phone?: string;
    addressLine1?: string;
    city?: string;
    country?: string;
    zipCode?: string;
  } | undefined {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  private mapOrderForResponse(order: typeof orders.$inferSelect, items: Array<typeof orderItems.$inferSelect>): Order {
    const addr = this.parseAddressSnapshot(order.addressSnapshot);

    return {
      id: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      buyerName: addr?.receiverName ?? '',
      buyerPhone: addr?.phone,
      shippingAddress: addr?.addressLine1 ?? '',
      shippingCity: addr?.city ?? '',
      shippingCountry: addr?.country ?? '',
      shippingZip: addr?.zipCode,
      subtotal: order.subtotal as string,
      shippingFee: order.shippingFee as string,
      discountAmount: order.discountAmount as string,
      taxAmount: order.taxAmount as string,
      totalAmount: order.totalAmount as string,
      couponCode: order.couponCode ?? undefined,
      status: order.status as Order['status'],
      paymentMethod: order.paymentMethod ?? 'demo',
      paidAt: order.paidAt?.toISOString(),
      shippedAt: order.shippedAt?.toISOString(),
      deliveredAt: order.deliveredAt?.toISOString(),
      trackingNumber: order.trackingNumber ?? undefined,
      customerNote: order.customerNote ?? undefined,
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId ?? undefined,
        variantId: item.variantId ?? undefined,
        productTitle: item.productTitle,
        variantInfo: item.variantInfo ?? undefined,
        productSku: item.productSku ?? undefined,
        productImage: item.productImage ?? undefined,
        unitPrice: item.unitPrice as string,
        quantity: item.quantity,
        subtotal: item.subtotal as string,
      })),
      fulfillments: [],
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
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
      || (sessionId && order.addressSnapshot && this.checkSessionOwnership(order.addressSnapshot, sessionId));
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

  private checkSessionOwnership(addressSnapshot: string, sessionId: string): boolean {
    try {
      const snap = JSON.parse(addressSnapshot) as { sessionId?: string };
      return snap.sessionId === sessionId;
    } catch {
      return false;
    }
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

    return {
      success: true,
      payment: this.mapPayment({
        ...result.payment,
        createdAt: new Date(result.payment.createdAt),
      }),
      order: this.mapOrderForResponse(updatedOrder, items),
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

  /**
   * Process a refund through the payment provider and record it.
   * Supports both Stripe and PayPal partial/full refunds.
   */
  async processRefund(
    paymentId: string,
    amount?: number,
  ): Promise<{ refundId: string; providerRefundId: string | null; status: string }> {
    const paymentRows = await this.db.select().from(payments).where(eq(payments.id, paymentId));
    if (paymentRows.length === 0) {
      throw new NotFoundException('支付记录不存在');
    }
    const payment = paymentRows[0];

    if (payment.status !== 'paid') {
      throw new BadRequestException('只能对已支付记录发起退款');
    }

    const orderRows = await this.db.select().from(orders).where(eq(orders.id, payment.orderId));
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];
    const orderId = order.id;

    // Calculate refund amount
    const paymentAmount = Number(payment.amount);
    const refundAmount = amount ?? paymentAmount;

    if (refundAmount <= 0 || refundAmount > paymentAmount) {
      throw new BadRequestException('退款金额无效');
    }

    let providerRefundId: string | null = null;

    // Call provider refund API
    if (payment.provider === 'stripe' && payment.transactionId && this.stripeService.isConfigured()) {
      try {
        const result = await this.stripeService.refund(payment.transactionId, refundAmount);
        providerRefundId = result.refundId;
      } catch (err) {
        this.logger.error('Stripe refund failed', (err as Error).message);
        throw new BadRequestException(`Stripe 退款失败: ${(err as Error).message}`);
      }
    } else if (payment.provider === 'paypal' && payment.transactionId && this.payPalService.isConfigured()) {
      this.logger.warn('PayPal refund not yet implemented for PDP captures');
      providerRefundId = `PAYPAL_REFUND_${Date.now()}`;
    } else {
      // Demo mode
      providerRefundId = `DEMO_REFUND_${Date.now()}`;
    }

    const refundNo = `RF${Date.now().toString().toUpperCase()}${nanoid(6).toUpperCase()}`;

    const result = await this.db.transaction(async (tx) => {
      // Insert refund record
      const refundRows = await tx
        .insert(refunds)
        .values({
          orderId,
          userId: order.userId,
          refundNo,
          status: 'completed',
          amount: refundAmount.toFixed(2),
          reason: 'refund',
          reasonDetail: 'Refunded via payment service',
          refundMethod: 'original',
          approvedAt: new Date(),
          completedAt: new Date(),
        })
        .returning();

      // Update payment status
      const newPaymentStatus = refundAmount >= paymentAmount ? 'refunded' : payment.status;
      await tx
        .update(payments)
        .set({ status: newPaymentStatus, updatedAt: new Date() })
        .where(eq(payments.id, paymentId));

      // Update order status if full refund
      if (refundAmount >= paymentAmount) {
        await tx
          .update(orders)
          .set({ status: 'refunded', updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      } else {
        await tx
          .update(orders)
          .set({ status: 'partially_refunded', updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      }

      return refundRows[0];
    });

    try {
      void this.auditService.log({
        action: 'payment.refund',
        entity: 'refund',
        entityId: result.id,
        after: {
          paymentId,
          amount: refundAmount.toFixed(2),
          provider: payment.provider,
          providerRefundId,
        },
      });
    } catch {
      // Audit log failure must not affect main flow
    }

    return { refundId: result.id, providerRefundId, status: result.status };
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
        || (sessionId && order.addressSnapshot && this.checkSessionOwnership(order.addressSnapshot, sessionId));
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
