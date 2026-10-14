#!/usr/bin/env node
/**
 * 无模型 Key 降级冒烟（在未配置任何 LLM 凭据的实例上运行）：
 *   1) AI 端点全部返回统一诚实提示（"模型未配置…请填写模型"），绝不返回假数据
 *   2) 设置 / Agent 管理接口在没有 Key 时依然可用（商家可随时自己来填）
 *   3) 同一实例上的核心交易闭环（下单 → 支付 → 退款）照常运行
 * CI 中本脚本与 19 步业务冒烟跑在同一个无 Key 实例上。
 *
 * 用法：SMOKE_BASE=http://127.0.0.1:3000 DATABASE_URL=... node scripts/smoke-ai-degraded.mjs
 */
import postgres from 'postgres';

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:3000';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[degraded-smoke] DATABASE_URL is required');
  process.exit(1);
}

const runId = Date.now().toString(36);
const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
const NOT_CONFIGURED_HINT = '模型未配置';
let step = 0;

function ok(msg) {
  step += 1;
  console.log(`[degraded-smoke] ${String(step).padStart(2, '0')}. ${msg}`);
}
function assert(cond, msg) {
  if (!cond) {
    console.error(`[degraded-smoke] ASSERT FAILED: ${msg}`);
    process.exit(1);
  }
}

/** 认证类请求遇到 429（认证限流 5 次/分）时等待重试，避免多脚本连跑互相打扰 */
async function withAuthRetry(fn, maxAttempts = 6) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const status = Number((err && err.message && err.message.match(/-> (\d+)/) || [])[1] || 0);
      if (status !== 429 || attempt >= maxAttempts) throw err;
      const waitMs = 15000;
      console.warn(`[smoke] 命中认证限流，${waitMs / 1000}s 后重试（第 ${attempt} 次）`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

async function api(method, path, { cookie, json, expect = [200, 201] } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const body = await res.json().catch(() => null);
  if (!expect.includes(res.status)) {
    throw new Error(`${method} ${path} -> ${res.status} (expected ${expect}): ${JSON.stringify(body)}`);
  }
  return { status: res.status, body, cookie: setCookie.map((c) => c.split(';')[0]).join('; ') };
}

try {
  const health = await api('GET', '/api/health');
  assert(health.body?.status === 'ok', 'health 应为 ok');
  ok('health = ok（未配置 Key 也能正常启动）');

  const status = await api('GET', '/api/ai/status');
  assert(status.body?.configured === false, `AI 应为未配置态，实际 ${JSON.stringify(status.body)}`);
  assert(status.body?.source === 'none', `配置来源应为 none，实际 ${status.body?.source}`);
  ok('AI 状态：configured=false / source=none（环境与界面均未配置）');

  const seller = await withAuthRetry(() => api('POST', '/api/auth/register', {
    json: {
      email: `degraded-seller-${runId}@test.dev`,
      password: 'Passw0rd1',
      name: 'Degraded Seller',
      role: 'seller',
      sellerCode: 'smoke-secret',
    },
   }));
  const buyer = await withAuthRetry(() => api('POST', '/api/auth/register', {
    json: { email: `degraded-buyer-${runId}@test.dev`, password: 'Passw0rd1', name: 'Degraded Buyer' },
   }));

  // ---------- 1) AI 端点统一诚实拒绝 ----------
  const honestCalls = [
    ['POST', '/api/ai/support/chat', { cookie: buyer.cookie, json: { message: '你好', sessionId: `degraded-${runId}` } }],
    ['POST', '/api/ai/copywriter', { cookie: seller.cookie, json: { productNameZh: '测试' } }],
    ['POST', '/api/ai/translate', { cookie: seller.cookie, json: { text: 'hi', targetLang: 'en' } }],
    ['POST', '/api/ai/select/generate', { cookie: seller.cookie }],
    ['POST', '/api/ai/trend/generate', { cookie: seller.cookie }],
  ];
  for (const [method, path, opts] of honestCalls) {
    const res = await api(method, path, { ...opts, expect: [400] });
    assert(
      typeof res.body?.message === 'string' && res.body.message.includes(NOT_CONFIGURED_HINT),
      `${path} 应返回统一诚实提示，实际: ${JSON.stringify(res.body)}`,
    );
  }
  ok('5 个 AI 端点全部返回统一诚实提示（"模型未配置…请填写模型"），无假数据');

  const failures = await sql`
    SELECT count(*)::int AS n FROM ai_usage_log
    WHERE success = false AND error_message LIKE ${'%' + NOT_CONFIGURED_HINT + '%'}`;
  assert(failures[0].n >= 5, `未配置的调用应诚实计入计量（success=false），实际 ${failures[0].n}`);
  ok('AI 计量：未配置调用如实记录为失败（可观测、可审计）');

  // ---------- 2) 无 Key 时设置与 Agent 管理照常可用 ----------
  const settings = await api('GET', '/api/ai/settings', { cookie: seller.cookie });
  assert(settings.body?.configured === false && settings.body?.apiKeyMasked === null, '设置接口应正常返回未配置态');
  assert(typeof settings.body?.baseUrl === 'string' && settings.body.baseUrl.length > 0, '应返回默认 Base URL 供预填');

  const settingsTest = await api('POST', '/api/ai/settings/test', { cookie: seller.cookie });
  assert(settingsTest.body?.ok === false && settingsTest.body.message.includes(NOT_CONFIGURED_HINT), '连通测试应诚实返回未配置');

  const agents = await api('GET', '/api/ai/agents', { cookie: seller.cookie });
  assert(agents.body?.builtin?.length === 5, '内置 Agent 列表不受配置影响');

  const created = await api('POST', '/api/ai/agents', {
    cookie: seller.cookie,
    json: { name: '降级测试 Agent', slug: `degraded-${runId}`, systemPrompt: '测试', userPromptTemplate: '{{input}}' },
  });
  const run = await api('POST', `/api/ai/agents/${created.body.id}/run`, {
    cookie: seller.cookie,
    json: { input: '你好' },
    expect: [400],
  });
  assert(run.body?.message?.includes(NOT_CONFIGURED_HINT), '自定义 Agent 运行也应诚实提示');
  await api('DELETE', `/api/ai/agents/${created.body.id}`, { cookie: seller.cookie });
  ok('设置 / Agent 管理在无 Key 时完全可用（商家可随时自己来填；运行则诚实拒绝）');

  // ---------- 3) 核心交易闭环不受影响 ----------
  const [category] = await sql`
    INSERT INTO categories (name_zh, name_en, slug)
    VALUES ('降级类目', 'Degraded Category', ${'degraded-cat-' + runId}) RETURNING id`;
  const [product] = await sql`
    INSERT INTO products (seller_id, title_zh, title_en, category_id, status)
    VALUES (${seller.body.user.id}, '降级商品', ${'Degraded Item ' + runId}, ${category.id}, 'active') RETURNING id`;
  const [variant] = await sql`
    INSERT INTO product_variants (product_id, sku, price, stock, status)
    VALUES (${product.id}, ${'DEG-SKU-' + runId}, 10.00, 50, 'active') RETURNING id`;
  await api('POST', '/api/shipping-templates', {
    cookie: seller.cookie,
    json: { name: `degraded-tpl-${runId}`, isDefault: true, baseFee: '5.00', extraFeePerUnit: '2.00', freeShippingThreshold: '100.00', unitType: 'quantity' },
  });

  const order = await api('POST', '/api/orders', {
    cookie: buyer.cookie,
    json: {
      buyerName: 'Degraded Buyer', shippingAddress: '1 No-Key St', shippingCity: 'NYC', shippingCountry: 'US',
      paymentMethod: 'demo',
      items: [{ productId: product.id, variantId: variant.id, quantity: 2 }],
    },
  });
  assert(order.body?.totalAmount === '27.00', `下单金额应为 27.00，实际 ${order.body?.totalAmount}`);

  const pay = await api('POST', '/api/payments/pay', {
    cookie: buyer.cookie,
    json: { orderId: order.body.id, provider: 'demo' },
  });
  assert(pay.body?.order?.status === 'paid', '演示支付应成功');

  const refund = await api('POST', `/api/orders/${order.body.id}/refunds`, {
    cookie: buyer.cookie,
    json: { amount: '27.00', reason: 'other', reasonDetail: 'degraded smoke' },
  });
  await api('POST', `/api/refunds/${refund.body.id}/approve`, { cookie: seller.cookie, json: { reply: 'ok' } });
  const [finalOrder] = await sql`SELECT status FROM orders WHERE id = ${order.body.id}`;
  assert(finalOrder.status === 'refunded', `全退后订单应为 refunded，实际 ${finalOrder.status}`);
  ok('核心交易闭环（下单 27.00 → 支付 → 全退款）在无 Key 实例上照常运行');

  console.log('[degraded-smoke] ALL PASSED —— 不填 Key：AI 诚实提示，其余功能一切正常');
} catch (err) {
  console.error('[degraded-smoke] FAILED:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
