#!/usr/bin/env node
/**
 * AI 运营副驾全链路冒烟（mock LLM）：
 *   1) 读工具直接执行并回填（店铺概况 / 低库存）
 *   2) 写工具只生成待审批动作，审批前数据库不变
 *   3) 批准后经既有业务服务真实执行（订单状态机）
 *   4) 拒绝后不产生任何副作用（优惠券）
 *   5) 买家访问副驾被 403 拒绝
 *
 * 前置：
 *   node scripts/mock-providers.mjs                     # 监听 4880
 *   应用以 LLM_BASE_URL=http://127.0.0.1:4880/llm LLM_API_KEY=mock-key 启动，
 *   并设置 SELLER_REGISTRATION_CODE=smoke-secret（脚本自行注册卖家/买家，不依赖演示数据）
 * 用法：
 *   SMOKE_BASE=http://127.0.0.1:3105 MOCK_BASE=http://127.0.0.1:4880 \
 *   DATABASE_URL=postgresql://flow:pass@localhost:5433/flow node scripts/smoke-copilot.mjs
 */
import postgres from 'postgres';

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:3100';
const MOCK = process.env.MOCK_BASE ?? 'http://127.0.0.1:4880';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[copilot-smoke] DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
const runId = Date.now().toString(36);
let step = 0;

function ok(msg) {
  step += 1;
  console.log(`[copilot-smoke] ${String(step).padStart(2, '0')}. ${msg}`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[copilot-smoke] ASSERT FAILED: ${message}`);
    process.exit(1);
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
  const body = await res.json().catch(() => null);
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const nextCookie = setCookie.length > 0 ? setCookie.map((c) => c.split(';')[0]).join('; ') : cookie;
  if (!expect.includes(res.status)) {
    throw new Error(`${method} ${path} -> ${res.status} (expected ${expect}): ${JSON.stringify(body)}`);
  }
  return { status: res.status, body, cookie: nextCookie };
}

try {
  // 自行注册（不依赖演示种子数据）：卖家需带邀请码，买家自由注册
  const seller = await api('POST', '/api/auth/register', {
    json: {
      email: `copilot-seller-${runId}@test.dev`,
      password: 'Passw0rd1',
      name: 'Copilot Seller',
      role: 'seller',
      sellerCode: process.env.SELLER_REGISTRATION_CODE ?? 'smoke-secret',
    },
  });
  const buyer = await api('POST', '/api/auth/register', {
    json: {
      email: `copilot-buyer-${runId}@test.dev`,
      password: 'Passw0rd1',
      name: 'Copilot Buyer',
    },
  });
  const sellerId = seller.body.user.id;
  ok('卖家/买家注册成功');

  // 把模型指向本地模拟器（UI 设置优先级最高，服务端已运行也可即时生效）
  await api('PUT', '/api/ai/settings', {
    cookie: seller.cookie,
    json: { baseUrl: `${MOCK}/llm`, apiKey: 'mock-key', model: 'mock-copilot' },
  });
  const status = await api('GET', '/api/ai/status');
  assert(status.body.configured === true, 'AI 状态应为已配置');
  ok('模型设置指向本地模拟器');

  const tools = await api('GET', '/api/copilot/tools', { cookie: seller.cookie });
  assert(tools.body.tools.length >= 6, `工具目录应至少 6 个，实际 ${tools.body.tools.length}`);
  assert(tools.body.tools.some((t) => t.name === 'update_order_status' && t.kind === 'write'), '应包含写工具 update_order_status');
  ok(`工具目录读取成功（${tools.body.tools.length} 个）`);

  // ---------- 1. 读工具 ----------
  const conversation = await api('POST', '/api/copilot/conversations', {
    cookie: seller.cookie,
    json: { title: '冒烟对话' },
  });
  const conversationId = conversation.body.id;

  const overview = await api('POST', `/api/copilot/conversations/${conversationId}/messages`, {
    cookie: seller.cookie,
    json: { content: '看一下店铺概况' },
  });
  assert(overview.body.toolTrace.some((t) => t.tool === 'get_store_overview' && t.kind === 'read'), '应执行读工具 get_store_overview');
  assert(typeof overview.body.reply === 'string' && overview.body.reply.length > 0, '应有最终答复');

  const detail = await api('GET', `/api/copilot/conversations/${conversationId}`, { cookie: seller.cookie });
  const toolMessage = detail.body.messages.find((m) => m.role === 'tool' && m.toolName === 'get_store_overview');
  assert(toolMessage && toolMessage.toolOk === true, '工具消息应落库且标记成功');
  assert((toolMessage.content ?? '').includes('GMV'), '工具结果应包含真实聚合字段');
  ok('读工具：执行 + 结果回填 + 消息落库');

  // ---------- 2. 写工具：审批前不生效 ----------
  const [order] = await sql`
    INSERT INTO orders (order_no, user_id, seller_id, status, subtotal, total_amount, payment_method, address_snapshot)
    VALUES (
      ${'ORDCOPILOT' + runId.toUpperCase()},
      ${buyer.body.user.id},
      ${sellerId},
      'paid',
      50.00,
      50.00,
      'demo',
      ${JSON.stringify({ receiverName: 'Copilot Tester', addressLine1: '1 Test Rd', city: 'Testville', country: 'US' })}
    ) RETURNING id, order_no`;

  const writeRes = await api('POST', `/api/copilot/conversations/${conversationId}/messages`, {
    cookie: seller.cookie,
    json: { content: `请把订单 ${order.order_no} 变更为已发货` },
  });
  const pending = writeRes.body.actions.find((a) => a.toolName === 'update_order_status');
  assert(pending, '应生成待审批动作 update_order_status');
  assert(pending.status === 'pending', `动作状态应为 pending，实际 ${pending.status}`);
  assert(writeRes.body.toolTrace.some((t) => t.tool === 'update_order_status' && t.kind === 'write'), '工具轨迹应记录写动作');

  const [orderBefore] = await sql`SELECT status FROM orders WHERE id = ${order.id}`;
  assert(orderBefore.status === 'paid', `审批前订单状态应保持 paid，实际 ${orderBefore.status}`);
  ok('写工具：只生成待审批动作，数据库未变更');

  // ---------- 3. 批准后真实执行 ----------
  const impact = await api('GET', `/api/copilot/actions/${pending.id}/impact`, { cookie: seller.cookie });
  assert(typeof impact.body.impact === 'string' && impact.body.impact.includes('1'), `影响预览应匹配 1 条，实际 ${impact.body.impact}`);

  const approved = await api('POST', `/api/copilot/actions/${pending.id}/resolve`, {
    cookie: seller.cookie,
    json: { approve: true },
  });
  assert(approved.body.ok === true, `批准应成功：${approved.body.message}`);
  assert(approved.body.action.status === 'executed', `动作应为 executed，实际 ${approved.body.action.status}`);

  const [orderAfter] = await sql`SELECT status, carrier, tracking_number FROM orders WHERE id = ${order.id}`;
  assert(orderAfter.status === 'shipped', `批准后订单应为 shipped，实际 ${orderAfter.status}`);
  assert(orderAfter.tracking_number === 'MOCK-TRACK-001', `运单号应写入，实际 ${orderAfter.tracking_number}`);

  const reapprove = await api('POST', `/api/copilot/actions/${pending.id}/resolve`, {
    cookie: seller.cookie,
    json: { approve: true },
    expect: [400],
  });
  assert(reapprove.status === 400, '重复审批应被拒绝');
  ok('批准：经订单状态机真实执行 + 幂等拒绝重复审批');

  // ---------- 4. 拒绝后无副作用 ----------
  const couponCode = `COP${runId.toUpperCase().slice(-6)}`;
  const couponRes = await api('POST', `/api/copilot/conversations/${conversationId}/messages`, {
    cookie: seller.cookie,
    json: { content: `帮我创建一个优惠券 ${couponCode}，打九折` },
  });
  const couponAction = couponRes.body.actions.find((a) => a.toolName === 'create_coupon');
  assert(couponAction, '应生成待审批动作 create_coupon');

  const rejected = await api('POST', `/api/copilot/actions/${couponAction.id}/resolve`, {
    cookie: seller.cookie,
    json: { approve: false, reason: '冒烟测试：拒绝' },
  });
  assert(rejected.body.ok === true && rejected.body.action.status === 'rejected', '拒绝应成功并标记 rejected');

  const couponRows = await sql`SELECT id FROM coupons WHERE code = ${couponCode}`;
  assert(couponRows.length === 0, '拒绝后不应创建优惠券');
  ok('拒绝：动作标记 rejected 且无副作用');

  // ---------- 5. 店铺巡检（先造一个低库存商品） ----------
  const [lowProduct] = await sql`
    INSERT INTO products (seller_id, title_zh, title_en, status, total_stock)
    VALUES (${sellerId}, ${'清仓商品' + runId}, ${'Clearance ' + runId}, 'active', 3) RETURNING id`;

  const insights = await api('GET', '/api/copilot/insights', { cookie: seller.cookie });
  assert(Array.isArray(insights.body.insights), '巡检应返回 insights 数组');
  assert(typeof insights.body.generatedAt === 'string', '巡检应带生成时间');
  const lowStockInsight = insights.body.insights.find((i) => i.type === 'low_stock' && i.entityId === lowProduct.id);
  assert(lowStockInsight, '巡检应识别出刚建的低库存商品');
  assert(lowStockInsight.severity === 'warning', `库存 3 应为 warning，实际 ${lowStockInsight.severity}`);
  assert(typeof lowStockInsight.prompt === 'string' && lowStockInsight.prompt.length > 0, '告警应带可执行 prompt');
  ok(`店铺巡检：${insights.body.insights.length} 项告警，低库存已识别`);

  // ---------- 6. 多步计划（批次） ----------
  const planRes = await api('POST', `/api/copilot/conversations/${conversationId}/messages`, {
    cookie: seller.cookie,
    json: { content: '帮我做一个清库存促销计划' },
  });
  const batchId = planRes.body.actions[0]?.batchId;
  assert(planRes.body.actions.length >= 2, `多步计划应产生 ≥2 个动作，实际 ${planRes.body.actions.length}`);
  assert(batchId && planRes.body.actions.every((a) => a.batchId === batchId), '同一轮动作应共享批次号');
  assert(planRes.body.actions.every((a) => a.status === 'pending'), '批次动作应为 pending');

  const planAction = planRes.body.actions.find((a) => a.toolName === 'update_product_status');
  assert(planAction, '多步计划应包含 update_product_status 动作');
  const plannedProductId = planAction.args.productId;

  const [productBefore] = await sql`SELECT status FROM products WHERE id = ${plannedProductId}`;
  assert(productBefore.status === 'active', '审批前商品应保持 active');

  const batchApproved = await api('POST', `/api/copilot/batches/${batchId}/resolve`, {
    cookie: seller.cookie,
    json: { approve: true },
  });
  assert(batchApproved.body.ok === true, `整批批准应成功：${batchApproved.body.message}`);
  assert(batchApproved.body.actions.every((a) => a.status === 'executed'), '整批动作应全部 executed');

  const [productAfter] = await sql`SELECT status FROM products WHERE id = ${plannedProductId}`;
  assert(productAfter.status === 'inactive', `整批执行后商品应下架，实际 ${productAfter.status}`);
  const planCoupon = await sql`SELECT id FROM coupons WHERE code = 'CLEAR10'`;
  assert(planCoupon.length === 1, '清仓券应已创建');
  ok(`多步计划：${batchApproved.body.actions.length} 步整批执行完成`);

  // ---------- 7. 越权 ----------
  const forbidden = await api('GET', '/api/copilot/conversations', {
    cookie: buyer.cookie,
    expect: [403],
  });
  assert(forbidden.status === 403, '买家访问副驾应 403');
  ok('权限：买家访问副驾被 403 拒绝');

  // 还原模型设置，避免影响其他冒烟（providers 冒烟要求初始来源为 env）
  await api('PUT', '/api/ai/settings', {
    cookie: seller.cookie,
    json: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: '' },
  });

  console.log('[copilot-smoke] ALL PASSED');
  process.exitCode = 0;
} catch (error) {
  console.error('[copilot-smoke] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
