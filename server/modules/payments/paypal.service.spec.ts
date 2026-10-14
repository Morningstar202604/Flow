import { createHash, createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayPalService } from './paypal.service';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

/** 测试用子类：注入本地公钥代替从 PayPal 官方域拉证书（生产路径不变） */
class TestPayPalService extends PayPalService {
  protected async loadWebhookCert(_certUrl: string): Promise<KeyObject | null> {
    return publicKey;
  }
}

const WEBHOOK_ID = 'WH-TEST-1';
const CERT_URL = 'https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-TEST';

const eventBody = JSON.stringify({
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  resource: { id: 'CAP-1', custom_id: 'order-1', amount: { value: '10.00', currency_code: 'USD' } },
});

function signTransmission(body: string, transmissionId: string, transmissionTime: string): string {
  const signatureBase = `${transmissionId}|${transmissionTime}|${WEBHOOK_ID}|${createHash('sha256').update(body).digest('hex')}`;
  const signer = createSign('SHA256');
  signer.update(signatureBase);
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function headers(overrides: Record<string, string> = {}): Record<string, string> {
  const transmissionId = 'tid-1';
  const transmissionTime = '2026-10-14T00:00:00Z';
  return {
    'paypal-transmission-id': transmissionId,
    'paypal-transmission-time': transmissionTime,
    'paypal-transmission-sig': signTransmission(eventBody, transmissionId, transmissionTime),
    'paypal-cert-url': CERT_URL,
    'paypal-auth-algo': 'SHA256withRSA',
    ...overrides,
  };
}

// 行为契约（R10）：PayPal webhook 验签 fail closed —— RSA 签名/证书域/请求头任何一项不满足都拒绝
describe('PayPalService.verifyWebhook', () => {
  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = 'client-id';
    process.env.PAYPAL_CLIENT_SECRET = 'client-secret';
    process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;
  });

  it('R10: 有效 RSA 签名通过并返回事件', async () => {
    const svc = new TestPayPalService();
    const result = await svc.verifyWebhook(headers(), eventBody);
    expect(result?.eventType).toBe('PAYMENT.CAPTURE.COMPLETED');
    const resource = result?.data as { id?: string; custom_id?: string };
    expect(resource.custom_id).toBe('order-1');
  });

  it('R10: 篡改请求体导致签名不匹配拒绝', async () => {
    const svc = new TestPayPalService();
    const tampered = eventBody.replace('order-1', 'order-evil');
    expect(await svc.verifyWebhook(headers(), tampered)).toBeNull();
  });

  it('R10: 证书 URL 非 PayPal 官方域拒绝（防证书注入）', async () => {
    const svc = new TestPayPalService();
    expect(await svc.verifyWebhook(headers({ 'paypal-cert-url': 'https://evil.example.com/cert.pem' }), eventBody)).toBeNull();
  });

  it('R10: 缺少必要请求头/错误算法拒绝', async () => {
    const svc = new TestPayPalService();
    expect(await svc.verifyWebhook(headers({ 'paypal-transmission-id': '' }), eventBody)).toBeNull();
    expect(await svc.verifyWebhook(headers({ 'paypal-auth-algo': 'MD5' }), eventBody)).toBeNull();
  });

  it('R10: 未配置凭据或 webhook id 一律拒绝', async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    const noWebhookId = new TestPayPalService();
    expect(await noWebhookId.verifyWebhook(headers(), eventBody)).toBeNull();

    process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    const noSecret = new TestPayPalService();
    expect(await noSecret.verifyWebhook(headers(), eventBody)).toBeNull();

    process.env.PAYPAL_CLIENT_SECRET = 'client-secret';
  });
});

// 行为契约（R11）：退款调用 —— 携带 OAuth Bearer、按 capture id 退款、金额两位小数
describe('PayPalService.refundCapture', () => {
  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = 'client-id';
    process.env.PAYPAL_CLIENT_SECRET = 'client-secret';
  });

  it('R11: 请求 URL/鉴权/请求体符合 PayPal REST 规范', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (String(url).includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'AT-1', expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'RF-1', status: 'COMPLETED' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const svc = new PayPalService();
    const result = await svc.refundCapture('CAP-9', 30.5, 'usd');

    expect(result).toEqual({ refundId: 'RF-1', status: 'COMPLETED' });
    const refundCall = calls.find((c) => c.url.includes('/refunds'));
    expect(refundCall).toBeTruthy();
    expect(refundCall!.url).toContain('/v2/payments/captures/CAP-9/refunds');
    expect((refundCall!.init.headers as Record<string, string>)['Authorization']).toBe('Bearer AT-1');
    const body = JSON.parse(String(refundCall!.init.body)) as { amount: { value: string; currency_code: string } };
    expect(body.amount).toEqual({ value: '30.50', currency_code: 'USD' });

    vi.unstubAllGlobals();
  });

  it('R11: 渠道失败时抛错（绝不伪造成功）', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      if (String(url).includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'AT-1', expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ name: 'INVALID_REQUEST' }), { status: 400 });
    }));

    const svc = new PayPalService();
    await expect(svc.refundCapture('CAP-9', 30.5)).rejects.toThrow(/PayPal refund failed/);

    vi.unstubAllGlobals();
  });
});
