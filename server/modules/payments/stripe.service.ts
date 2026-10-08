import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly secretKey: string | undefined;
  private readonly webhookSecret: string | undefined;
  private readonly baseUrl = 'https://api.stripe.com';

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!this.secretKey) {
      this.logger.warn(
        'Stripe not configured: STRIPE_SECRET_KEY missing. Running in demo mode.',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.secretKey;
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    orderId: string,
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    if (!this.secretKey) {
      throw new Error('Stripe not configured');
    }

    const body = new URLSearchParams({
      amount: Math.round(amount * 100).toString(),
      currency: currency.toLowerCase(),
      'metadata[orderId]': orderId,
    });

    const response = await fetch(`${this.baseUrl}/v1/payment_intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${this.secretKey}`,
        'Stripe-Version': '2024-06-20',
      },
      body,
    });

    const data = await response.json() as { client_secret?: string; id?: string };
    if (!response.ok) {
      throw new Error(`Stripe createPaymentIntent failed: ${JSON.stringify(data)}`);
    }

    return {
      clientSecret: data.client_secret ?? '',
      paymentIntentId: data.id ?? '',
    };
  }

  constructEvent(
    payload: string,
    signature: string,
  ): { type: string; data: unknown } | null {
    if (!this.webhookSecret) {
      return null;
    }

    try {
      const tHeader = signature
        .split(',')
        .find((elem: string) => elem.trim().startsWith('t='))
        ?.split('=')[1];
      const v1Signature = signature
        .split(',')
        .find((elem: string) => elem.trim().startsWith('v1='))
        ?.split('=')[1];

      if (!tHeader || !v1Signature) return null;

      const signedPayload = `${tHeader}.${payload}`;
      const expectedSignature = this.signHmac(signedPayload, this.webhookSecret);

      if (v1Signature !== expectedSignature) return null;

      const event = JSON.parse(payload);
      return { type: event.type, data: event.data?.object };
    } catch {
      return null;
    }
  }

  async refund(
    paymentIntentId: string,
    amount?: number,
  ): Promise<{ refundId: string }> {
    if (!this.secretKey) {
      throw new Error('Stripe not configured');
    }

    const params = new URLSearchParams({ payment_intent: paymentIntentId });
    if (amount !== undefined) {
      params.append('amount', Math.round(amount * 100).toString());
    }

    const response = await fetch(`${this.baseUrl}/v1/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${this.secretKey}`,
        'Stripe-Version': '2024-06-20',
      },
      body: params,
    });

    const data = await response.json() as { id?: string };
    if (!response.ok) {
      throw new Error(`Stripe refund failed: ${JSON.stringify(data)}`);
    }

    return { refundId: data.id ?? '' };
  }

  private signHmac(message: string, secret: string): string {
    return createHmac('sha256', secret).update(message).digest('hex');
  }
}
