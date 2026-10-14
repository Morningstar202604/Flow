import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { StripeService } from './stripe.service';

const SECRET = 'whsec_test_secret';

function sign(payload: string, timestamp: number, secret = SECRET): string {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

const now = (): number => Math.floor(Date.now() / 1000);
const payload = JSON.stringify({
  type: 'payment_intent.succeeded',
  data: { object: { id: 'pi_test_1', metadata: { orderId: 'order-1' } } },
});

interface EventData {
  id?: string;
  metadata?: { orderId?: string };
}

// 行为契约（R9）：Stripe webhook 验签 fail closed —— 签名/HMAC/时间戳窗口任何一项不满足都拒绝
describe('StripeService.verifyAndParse', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  it('R9: 有效签名解析事件（t + v1）', () => {
    const svc = new StripeService();
    const event = svc.verifyAndParse(payload, sign(payload, now()));
    expect(event?.type).toBe('payment_intent.succeeded');
    const data = event?.data as EventData;
    expect(data.metadata?.orderId).toBe('order-1');
  });

  it('R9: Buffer 载荷同样支持', () => {
    const svc = new StripeService();
    const event = svc.verifyAndParse(Buffer.from(payload, 'utf8'), sign(payload, now()));
    expect(event?.type).toBe('payment_intent.succeeded');
  });

  it('R9: 篡改载荷验签失败', () => {
    const svc = new StripeService();
    const signature = sign(payload, now());
    const tampered = payload.replace('order-1', 'order-evil');
    expect(svc.verifyAndParse(tampered, signature)).toBeNull();
  });

  it('R9: 时间戳超出容忍窗口拒绝（防重放）', () => {
    const svc = new StripeService();
    expect(svc.verifyAndParse(payload, sign(payload, now() - 600))).toBeNull();
    expect(svc.verifyAndParse(payload, sign(payload, now() + 600))).toBeNull();
  });

  it('R9: 错误密钥拒绝', () => {
    const svc = new StripeService();
    expect(svc.verifyAndParse(payload, sign(payload, now(), 'whsec_wrong'))).toBeNull();
  });

  it('R9: 密钥轮换期多 v1 签名 —— 任意一个匹配即通过', () => {
    const svc = new StripeService();
    const valid = sign(payload, now()).split('v1=')[1];
    const header = `t=${now()},v1=deadbeefdeadbeef,v1=${valid}`;
    expect(svc.verifyAndParse(payload, header)).not.toBeNull();
  });

  it('R9: 缺少 t 或 v1 拒绝', () => {
    const svc = new StripeService();
    expect(svc.verifyAndParse(payload, `v1=${'a'.repeat(64)}`)).toBeNull();
    expect(svc.verifyAndParse(payload, `t=${now()}`)).toBeNull();
    expect(svc.verifyAndParse(payload, '')).toBeNull();
  });

  it('R9: 未配置 webhook secret 一律拒绝', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const svc = new StripeService();
    expect(svc.verifyAndParse(payload, sign(payload, now()))).toBeNull();
  });
});
