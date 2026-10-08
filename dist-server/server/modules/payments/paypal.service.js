"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PayPalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
let PayPalService = PayPalService_1 = class PayPalService {
    logger = new common_1.Logger(PayPalService_1.name);
    clientId;
    clientSecret;
    baseUrl;
    accessToken = null;
    tokenExpiresAt = 0;
    constructor() {
        this.clientId = process.env.PAYPAL_CLIENT_ID;
        this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
        this.baseUrl =
            process.env.PAYPAL_MODE === 'live'
                ? 'https://api-m.paypal.com'
                : 'https://api-m.sandbox.paypal.com';
        if (!this.clientId || !this.clientSecret) {
            this.logger.warn('PayPal not configured: PAYPAL_CLIENT_ID and/or PAYPAL_CLIENT_SECRET missing. Running in demo mode.');
        }
    }
    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    }
    async createOrder(amount, currency, orderId) {
        if (!this.isConfigured()) {
            throw new Error('PayPal not configured');
        }
        const token = await this.getAccessToken();
        const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        custom_id: orderId,
                        amount: {
                            currency_code: currency.toUpperCase(),
                            value: amount.toFixed(2),
                        },
                    },
                ],
                application_context: {
                    return_url: `${process.env.APP_URL || ''}/orders?paypal=success`,
                    cancel_url: `${process.env.APP_URL || ''}/checkout?paypal=cancel`,
                },
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`PayPal create order failed: ${JSON.stringify(data)}`);
        }
        const approveLink = data.links?.find((link) => link.rel === 'approve');
        return {
            paypalOrderId: data.id ?? '',
            approveUrl: approveLink?.href ?? '',
        };
    }
    async captureOrder(paypalOrderId) {
        if (!this.isConfigured()) {
            throw new Error('PayPal not configured');
        }
        const token = await this.getAccessToken();
        const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                Prefer: 'return=representation',
            },
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`PayPal capture failed: ${JSON.stringify(data)}`);
        }
        const purchaseUnit = data.purchase_units?.[0];
        const paymentCapture = purchaseUnit?.payments?.captures?.[0];
        return {
            status: data.status,
            transactionId: paymentCapture?.id ?? data.id,
            amount: Number(purchaseUnit?.amount?.value ?? 0),
            currency: purchaseUnit?.amount?.currency_code ?? 'USD',
        };
    }
    async verifyWebhook(headers, body) {
        if (!this.isConfigured()) {
            this.logger.warn('PayPal webhook rejected: PayPal not configured');
            return null;
        }
        const webhookId = process.env.PAYPAL_WEBHOOK_ID;
        if (!webhookId) {
            this.logger.warn('PayPal webhook rejected: PAYPAL_WEBHOOK_ID not configured');
            return null;
        }
        const transmissionId = headers['paypal-transmission-id'] ?? '';
        const transmissionTime = headers['paypal-transmission-time'] ?? '';
        const transmissionSig = headers['paypal-transmission-sig'] ?? '';
        const certUrl = headers['paypal-cert-url'] ?? '';
        const authAlgo = headers['paypal-auth-algo'] ?? 'SHA256withRSA';
        if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl) {
            this.logger.warn('PayPal webhook rejected: missing required headers');
            return null;
        }
        if (authAlgo !== 'SHA256withRSA') {
            this.logger.warn(`PayPal webhook rejected: unsupported auth algo ${authAlgo}`);
            return null;
        }
        if (!certUrl.startsWith('https://api-m.sandbox.paypal.com/') && !certUrl.startsWith('https://api-m.paypal.com/') && !certUrl.startsWith('https://www.paypal.com/')) {
            this.logger.warn(`PayPal webhook rejected: invalid cert url ${certUrl}`);
            return null;
        }
        let publicKey = null;
        try {
            const certResponse = await fetch(certUrl);
            if (!certResponse.ok) {
                this.logger.warn(`PayPal webhook rejected: failed to fetch cert (${certResponse.status})`);
                return null;
            }
            const certPem = await certResponse.text();
            publicKey = crypto.createPublicKey(certPem);
        }
        catch (err) {
            this.logger.warn('PayPal webhook rejected: failed to load cert', err.message);
            return null;
        }
        let event;
        try {
            event = JSON.parse(body);
        }
        catch {
            this.logger.warn('PayPal webhook rejected: invalid JSON body');
            return null;
        }
        const signatureBase = `${transmissionId}|${transmissionTime}|${webhookId}|${crypto.createHash('sha256').update(body).digest('hex')}`;
        const signatureBuffer = Buffer.from(transmissionSig, 'base64');
        const verify = crypto.createVerify('SHA256');
        verify.update(signatureBase);
        verify.end();
        const valid = verify.verify(publicKey, signatureBuffer);
        if (!valid) {
            this.logger.warn('PayPal webhook rejected: signature verification failed');
            return null;
        }
        this.logger.log(`PayPal webhook verified: ${event.event_type}`);
        return { eventType: event.event_type ?? 'UNKNOWN', data: event.resource ?? {} };
    }
    async getAccessToken() {
        const now = Date.now();
        if (this.accessToken && now < this.tokenExpiresAt - 60000) {
            return this.accessToken;
        }
        const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${auth}`,
            },
            body: 'grant_type=client_credentials',
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`PayPal auth failed: ${JSON.stringify(data)}`);
        }
        this.accessToken = data.access_token ?? null;
        this.tokenExpiresAt = now + (data.expires_in ?? 0) * 1000;
        return this.accessToken;
    }
};
exports.PayPalService = PayPalService;
exports.PayPalService = PayPalService = PayPalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PayPalService);
//# sourceMappingURL=paypal.service.js.map