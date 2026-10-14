#!/usr/bin/env node
/**
 * 本地渠道模拟器（联调/CI 专用，不属于生产代码）：
 *   - Stripe：/stripe/*（payment_intents、refunds），并可签名回打应用的 stripe-webhook
 *   - PayPal：/paypal/*（oauth2 token、checkout orders、captures refunds）
 *   - LLM：/llm/v1/chat/completions（OpenAI 兼容，确定性输出，供 5 个 Agent 链路断言）
 *   - 观测：GET /_mock/state 返回全部调用记录；POST /_mock/reset 清空
 *
 * 用法：
 *   STRIPE_WEBHOOK_SECRET=whsec_mock APP_WEBHOOK_BASE=http://127.0.0.1:3000 \
 *   node scripts/mock-providers.mjs            # 默认监听 4880
 */
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 4880);
const APP_WEBHOOK_BASE = process.env.APP_WEBHOOK_BASE ?? 'http://127.0.0.1:3000';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_mock';

const state = {
  stripe: { intents: [], refunds: [] },
  paypal: { orders: [], refunds: [], tokens: 0 },
  llm: { calls: 0, agents: {} },
};

const seq = { stripe: 0, paypal: 0, event: 0 };
const intentsByOrder = new Map();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function classifyAgent(body) {
  const messages = body?.messages ?? [];
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const user = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  // 特征键取各 Agent 提示词中的独有输出字段（select 的数据上下文里也含 titleEn 字样，不能作判别键）
  if (user.includes('"bulletPoints"') || user.includes('"longDescription"')) return 'copywriter';
  if (user.includes('"keyword"') && user.includes('"confidence"')) return 'select';
  if (system.includes('翻译')) return 'translation';
  if (system.includes('市场分析师') || user.includes('市场趋势分析报告')) return 'trend';
  if (system.includes('智能客服')) return 'support';
  return 'unknown';
}

function llmContent(agent, body) {
  const user = (body?.messages ?? []).filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  // 自定义 Agent（unknown）要求 JSON 时返回合法 JSON 并回显输入，供断言模板渲染贯穿
  if (agent === 'unknown' && body?.response_format?.type === 'json_object') {
    return JSON.stringify({ mock: true, echo: user.slice(0, 200) });
  }
  switch (agent) {
    case 'copywriter':
      return JSON.stringify({
        titleEn: 'Mock Title EN',
        bulletPoints: ['Mock point 1', 'Mock point 2'],
        longDescription: 'Mock long description for smoke testing.',
        seoKeywords: 'mock, smoke, test',
      });
    case 'select':
      return JSON.stringify({
        items: [
          {
            keyword: 'Mock Keyword',
            estimatedDemand: 'high',
            suggestedPriceRange: '$19.99 - $29.99',
            reason: 'Mock reason for smoke testing.',
            confidence: 0.9,
          },
        ],
      });
    case 'translation': {
      const text = user.includes('：\n\n') ? user.split('：\n\n').slice(1).join('：\n\n').trim() : user;
      return `MOCK-TRANSLATED: ${text}`;
    }
    case 'trend':
      return [
        '# 市场趋势分析报告（Mock）',
        '## 热搜词分析',
        '- mock 热搜词',
        '## 价格带分析',
        '- mock 价格带',
        '## 季节性趋势建议',
        '- mock 季节建议',
        '## 行动建议',
        '1. mock 行动建议',
      ].join('\n');
    case 'support':
      return 'MOCK-REPLY: 已收到您的咨询，这是模拟客服回复。';
    default:
      return `MOCK-REPLY: ${user.slice(0, 500)}`;
  }
}

async function triggerStripeWebhook(orderId, amountCents) {
  const intent = intentsByOrder.get(orderId);
  seq.event += 1;
  const payload = JSON.stringify({
    id: `evt_mock_${seq.event}`,
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: intent?.id ?? `pi_mock_manual_${seq.event}`,
        amount_received: amountCents ?? intent?.amountCents ?? 0,
        currency: 'usd',
        metadata: { orderId },
      },
    },
  });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${t}.${payload}`).digest('hex');

  const resp = await fetch(`${APP_WEBHOOK_BASE}/api/payments/stripe-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': `t=${t},v1=${v1}`,
    },
    body: payload,
  });
  const body = await resp.json().catch(() => null);
  return { status: resp.status, body };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  try {
    // ---------- 观测接口 ----------
    if (method === 'GET' && path === '/_mock/state') {
      return json(res, 200, state);
    }
    if (method === 'POST' && path === '/_mock/reset') {
      state.stripe.intents = [];
      state.stripe.refunds = [];
      state.paypal.orders = [];
      state.paypal.refunds = [];
      state.llm.calls = 0;
      state.llm.agents = {};
      return json(res, 200, { ok: true });
    }

    // ---------- Stripe ----------
    if (method === 'POST' && path === '/stripe/v1/payment_intents') {
      const form = new URLSearchParams(await readBody(req));
      seq.stripe += 1;
      const intent = {
        id: `pi_mock_${seq.stripe}`,
        amountCents: Number(form.get('amount') ?? 0),
        currency: form.get('currency') ?? 'usd',
        orderId: form.get('metadata[orderId]') ?? null,
      };
      if (intent.orderId) intentsByOrder.set(intent.orderId, intent);
      state.stripe.intents.push(intent);
      return json(res, 200, { id: intent.id, client_secret: `${intent.id}_secret_mock`, status: 'requires_payment_method' });
    }
    if (method === 'POST' && path === '/stripe/v1/refunds') {
      const form = new URLSearchParams(await readBody(req));
      seq.stripe += 1;
      const refund = {
        id: `re_mock_${seq.stripe}`,
        paymentIntent: form.get('payment_intent'),
        amountCents: form.get('amount') ? Number(form.get('amount')) : null,
      };
      state.stripe.refunds.push(refund);
      return json(res, 200, { id: refund.id, status: 'succeeded' });
    }
    if (method === 'POST' && path === '/trigger/stripe/pay') {
      const body = JSON.parse((await readBody(req)) || '{}');
      if (!body.orderId) return json(res, 400, { error: 'orderId required' });
      const result = await triggerStripeWebhook(body.orderId, body.amountCents);
      return json(res, 200, result);
    }

    // ---------- PayPal ----------
    if (method === 'POST' && path === '/paypal/v1/oauth2/token') {
      state.paypal.tokens += 1;
      return json(res, 200, { access_token: 'MOCK-PAYPAL-AT', token_type: 'Bearer', expires_in: 3600 });
    }
    if (method === 'POST' && path === '/paypal/v2/checkout/orders') {
      const body = JSON.parse((await readBody(req)) || '{}');
      seq.paypal += 1;
      const order = {
        id: `PPO-MOCK-${seq.paypal}`,
        customId: body?.purchase_units?.[0]?.custom_id ?? null,
        amount: body?.purchase_units?.[0]?.amount?.value ?? null,
      };
      state.paypal.orders.push(order);
      return json(res, 200, {
        id: order.id,
        status: 'CREATED',
        links: [
          { rel: 'approve', href: `http://127.0.0.1:${PORT}/paypal/approve/${order.id}` },
          { rel: 'self', href: `http://127.0.0.1:${PORT}/paypal/v2/checkout/orders/${order.id}` },
        ],
      });
    }
    if (method === 'POST' && path.startsWith('/paypal/v2/payments/captures/') && path.endsWith('/refunds')) {
      const captureId = path.split('/')[5];
      const body = JSON.parse((await readBody(req)) || '{}');
      seq.paypal += 1;
      const refund = {
        id: `PPRF-MOCK-${seq.paypal}`,
        captureId,
        amount: body?.amount?.value ?? null,
        currency: body?.amount?.currency_code ?? null,
        auth: req.headers.authorization ?? null,
      };
      state.paypal.refunds.push(refund);
      return json(res, 200, { id: refund.id, status: 'COMPLETED' });
    }
    if (method === 'GET' && path.startsWith('/paypal/approve/')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<html><body>Mock PayPal approve page</body></html>');
    }

    // ---------- LLM（OpenAI 兼容） ----------
    if (method === 'POST' && path === '/llm/v1/chat/completions') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const agent = classifyAgent(body);
      state.llm.calls += 1;
      state.llm.agents[agent] = (state.llm.agents[agent] ?? 0) + 1;
      const content = llmContent(agent, body);
      return json(res, 200, {
        id: `chatcmpl-mock-${state.llm.calls}`,
        object: 'chat.completion',
        model: body.model ?? 'mock-model',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 42, completion_tokens: 24, total_tokens: 66 },
      });
    }

    return json(res, 404, { error: `no mock route: ${method} ${path}` });
  } catch (err) {
    return json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`[mock] providers listening on http://127.0.0.1:${PORT}`);
  console.log(`[mock] webhook callback base: ${APP_WEBHOOK_BASE}`);
});
