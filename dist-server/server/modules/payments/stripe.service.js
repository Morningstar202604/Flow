"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StripeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let StripeService = StripeService_1 = class StripeService {
    logger = new common_1.Logger(StripeService_1.name);
    secretKey;
    webhookSecret;
    baseUrl = 'https://api.stripe.com';
    constructor() {
        this.secretKey = process.env.STRIPE_SECRET_KEY;
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!this.secretKey) {
            this.logger.warn('Stripe not configured: STRIPE_SECRET_KEY missing. Running in demo mode.');
        }
    }
    isConfigured() {
        return !!this.secretKey;
    }
    async createPaymentIntent(amount, currency, orderId) {
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
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Stripe createPaymentIntent failed: ${JSON.stringify(data)}`);
        }
        return {
            clientSecret: data.client_secret ?? '',
            paymentIntentId: data.id ?? '',
        };
    }
    constructEvent(payload, signature) {
        if (!this.webhookSecret) {
            return null;
        }
        try {
            const tHeader = signature
                .split(',')
                .find((elem) => elem.trim().startsWith('t='))
                ?.split('=')[1];
            const v1Signature = signature
                .split(',')
                .find((elem) => elem.trim().startsWith('v1='))
                ?.split('=')[1];
            if (!tHeader || !v1Signature)
                return null;
            const signedPayload = `${tHeader}.${payload}`;
            const expectedSignature = this.signHmac(signedPayload, this.webhookSecret);
            if (v1Signature !== expectedSignature)
                return null;
            const event = JSON.parse(payload);
            return { type: event.type, data: event.data?.object };
        }
        catch {
            return null;
        }
    }
    async refund(paymentIntentId, amount) {
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
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Stripe refund failed: ${JSON.stringify(data)}`);
        }
        return { refundId: data.id ?? '' };
    }
    signHmac(message, secret) {
        return (0, crypto_1.createHmac)('sha256', secret).update(message).digest('hex');
    }
};
exports.StripeService = StripeService;
exports.StripeService = StripeService = StripeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StripeService);
//# sourceMappingURL=stripe.service.js.map