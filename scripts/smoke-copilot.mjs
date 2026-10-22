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

  // ---------- 7. 巡检阈值可配置 ----------
  const thresholdsBefore = await api('GET', '/api/copilot/insights/thresholds', { cookie: seller.cookie });
  assert(thresholdsBefore.body.lowStock === 10, `默认低库存阈值应为 10，实际 ${thresholdsBefore.body.lowStock}`);

  const saved = await api('PUT', '/api/copilot/insights/thresholds', {
    cookie: seller.cookie,
    json: { lowStock: 50 },
  });
  assert(saved.body.lowStock === 50, `保存后阈值应为 50，实际 ${saved.body.lowStock}`);

  // 造一个库存 30 的商品：默认阈值 10 下不告警，阈值 50 下应告警（证明阈值真的生效）
  const [midProduct] = await sql`
    INSERT INTO products (seller_id, title_zh, title_en, status, total_stock)
    VALUES (${sellerId}, ${'中库存商品' + runId}, ${'Mid Stock ' + runId}, 'active', 30) RETURNING id`;

  const insightsAfter = await api('GET', '/api/copilot/insights', { cookie: seller.cookie });
  assert(insightsAfter.body.thresholds.lowStock === 50, '巡检应使用新阈值');
  const stillFlagged = insightsAfter.body.insights.find(
    (i) => i.type === 'low_stock' && i.entityId === midProduct.id,
  );
  assert(!!stillFlagged, '阈值 50 下库存 30 的商品应被识别为低库存');

  const invalid = await api('PUT', '/api/copilot/insights/thresholds', {
    cookie: seller.cookie,
    json: { lowStock: 999999 },
    expect: [400],
  });
  assert(invalid.status === 400, '越界阈值应被 400 拒绝');

  await api('PUT', '/api/copilot/insights/thresholds', { cookie: seller.cookie, json: { lowStock: 10 } });
  ok('巡检阈值：默认 10 → 保存 50 → 巡检生效 → 越界拒绝 → 复原');

  // ---------- 8. 定时巡检 ----------
  const watchBefore = await api('GET', '/api/copilot/watch', { cookie: seller.cookie });
  assert(watchBefore.body.enabled === false, `定时巡检默认应关闭，实际 ${watchBefore.body.enabled}`);
  assert(watchBefore.body.intervalMinutes >= 5, '默认间隔应 ≥5 分钟');

  const watchOn = await api('PUT', '/api/copilot/watch', {
    cookie: seller.cookie,
    json: { enabled: true, intervalMinutes: 15 },
  });
  assert(watchOn.body.enabled === true && watchOn.body.intervalMinutes === 15, '定时巡检应保存成功');

  // 造一条低库存告警，确保本次巡检确有内容可比对
  await sql`
    INSERT INTO products (seller_id, title_zh, title_en, status, total_stock)
    VALUES (${sellerId}, ${'巡检告警商品' + runId}, ${'Watch Alert ' + runId}, 'active', 1)`;

  const watchRun = await api('POST', '/api/copilot/watch/run', { cookie: seller.cookie });
  assert(watchRun.body.ran === true, `手动巡检应执行，实际 ${JSON.stringify(watchRun.body)}`);
  assert(watchRun.body.message.includes('巡检'), '巡检摘要应可读');
  assert(watchRun.body.message.includes('新增 1 项'), `首次巡检应报告 1 条新增告警，实际 ${watchRun.body.message.slice(0, 80)}`);

  // 第二次执行：不应把旧告警算成"新增"
  const watchRun2 = await api('POST', '/api/copilot/watch/run', { cookie: seller.cookie });
  assert(watchRun2.body.ran === true, '第二次巡检也应执行');
  assert(watchRun2.body.message.includes('新增 0 项'), '第二次不应有新告警');

  // 通知渠道：指向 mock 的 /webhook/notify，再跑一次应真的推送到
  const notifyUrl = `${MOCK}/webhook/notify`;
  await api('PUT', '/api/copilot/watch', {
    cookie: seller.cookie,
    json: { enabled: true, notifyKind: 'webhook', notifyUrl, notifyOnlyOnNew: false },
  });
  const notifyRun = await api('POST', '/api/copilot/watch/run', { cookie: seller.cookie });
  assert(notifyRun.body.ran === true, '通知巡检应执行');
  assert(notifyRun.body.message.includes('已推送通知'), `应提示已推送，实际 ${notifyRun.body.message.slice(-40)}`);

  const mockState = await (async () => {
    const res = await fetch(`${MOCK}/_mock/state`);
    return res.json();
  })();
  assert(Array.isArray(mockState.webhook.received) && mockState.webhook.received.length >= 1, 'mock 应收到通知');
  const notified = mockState.webhook.received[mockState.webhook.received.length - 1];
  assert(typeof notified.text === 'string' && notified.text.includes('巡检'), '通知正文应为巡检摘要');

  await api('PUT', '/api/copilot/watch', {
    cookie: seller.cookie,
    json: { enabled: false, notifyKind: 'none', notifyUrl: '' },
  });
  ok('定时巡检：默认关闭 → 开启 15 分钟 → 手动执行 → 二次不重复告警 → webhook 推送成功 → 关闭');

  // ---------- 9. 需求缺口 → 草稿商品 ----------
  const gapKeyword = `测试缺口${runId.slice(-4)}`;
  await sql`
    INSERT INTO shopper_events (session_id, stage, keyword)
    VALUES (${'gap-session-' + runId}, 'search_miss', ${gapKeyword})`;

  const draft = await api('POST', '/api/copilot/shopper-demand-gaps/draft', {
    cookie: seller.cookie,
    json: { keyword: gapKeyword },
  });
  assert(draft.body.status === 'pending', `建草稿应生成待确认动作，实际 ${draft.body.status}`);
  assert(draft.body.toolName === 'create_draft_product', '动作工具应为 create_draft_product');

  const beforeDraftRows = await sql`SELECT id FROM products WHERE title_zh = ${gapKeyword}`;
  assert(beforeDraftRows.length === 0, '批准前不应创建商品');

  const draftApproved = await api('POST', `/api/copilot/actions/${draft.body.id}/resolve`, {
    cookie: seller.cookie,
    json: { approve: true },
  });
  assert(draftApproved.body.ok === true, `草稿商品应创建成功：${draftApproved.body.message}`);
  const afterDraftRows = await sql`
    SELECT id, status, total_stock FROM products WHERE title_zh = ${gapKeyword}`;
  assert(afterDraftRows.length === 1, '批准后应创建 1 个商品');
  assert(afterDraftRows[0].status === 'draft', `新商品应为 draft，实际 ${afterDraftRows[0].status}`);

  // AI 补全：mock LLM 会返回英文文案，应写回草稿
  const [draftCopy] = await sql`
    SELECT title_en, bullet_points_en, long_desc_en, seo_keywords_en
    FROM products WHERE id = ${afterDraftRows[0].id}`;
  assert(draftCopy.title_en === 'Mock Title EN', `英文标题应被 AI 补全，实际 ${draftCopy.title_en}`);
  assert(Array.isArray(draftCopy.bullet_points_en) && draftCopy.bullet_points_en.length >= 2, '英文卖点应被补全');
  assert((draftCopy.long_desc_en ?? '').length > 10, '英文长描述应被补全');
  assert((draftCopy.seo_keywords_en ?? '').length > 0, '英文 SEO 关键词应被补全');
  ok('需求缺口：一键建草稿 → 审批 → draft 状态 + AI 英文文案补全');

  // ---------- 10. 上架门禁：草稿缺图/零库存不可上架，补齐后可上架 ----------
  const draftId = afterDraftRows[0].id;
  const gateBlocked = await api('PATCH', `/api/products/${draftId}`, {
    cookie: seller.cookie,
    json: { status: 'active' },
    expect: [400],
  });
  assert(gateBlocked.status === 400, '缺图/零库存的草稿不应允许上架');

  const readiness = await api('GET', `/api/products/${draftId}/publish-readiness`, { cookie: seller.cookie });
  assert(readiness.body.ready === false, '就绪检查应判定未通过');
  assert(readiness.body.blockingCount > 0, '应列出待补齐项');
  assert(readiness.body.checks.some((c) => c.key === 'image' && !c.ok), '缺图应被识别');
  assert(readiness.body.checks.some((c) => c.key === 'stock' && !c.ok), '零库存应被识别');

  // 补齐：图 + 库存 + 描述（标题/价格/分类在上一步已具备）
  const [gateCategory] = await sql`
    INSERT INTO categories (name_zh, name_en, slug)
    VALUES ('门禁类目', 'Gate Category', ${'gate-cat-' + runId}) RETURNING id`;
  await sql`
    UPDATE products
    SET cover_image = ${'https://example.com/p-' + runId + '.png'}, total_stock = 10, category_id = ${gateCategory.id}
    WHERE id = ${draftId}`;
  await sql`
    UPDATE product_variants SET stock = 10 WHERE product_id = ${draftId}`;
  const readinessAfter = await api('GET', `/api/products/${draftId}/publish-readiness`, { cookie: seller.cookie });
  assert(readinessAfter.body.ready === true, `补齐后就绪检查应通过，实际 ${JSON.stringify(readinessAfter.body.checks.filter((c) => !c.ok))}`);

  const gatePassed = await api('PATCH', `/api/products/${draftId}`, {
    cookie: seller.cookie,
    json: { status: 'active' },
  });
  assert(gatePassed.status === 200, `补齐后应允许上架，实际 ${gatePassed.status}`);
  const [published] = await sql`SELECT status FROM products WHERE id = ${draftId}`;
  assert(published.status === 'active', `商品应为 active，实际 ${published.status}`);
  ok('上架门禁：缺图零库存被拒 → 补齐后通过 → 状态 active');

  // ---------- 11. 邮件通道（配置校验路径：SMTP 不通时应诚实降级，不影响巡检） ----------
  const emailCfg = await api('PUT', '/api/copilot/watch', {
    cookie: seller.cookie,
    json: {
      enabled: true,
      notifyKind: 'email',
      notifyUrl: '',
      notifySmtp: {
        host: '127.0.0.1',
        port: 2525,
        secure: false,
        from: 'bot@test.dev',
        to: 'owner@test.dev',
      },
      notifyOnlyOnNew: false,
      notifySubjectTemplate: '【巡检】{{count}} 项 / 严重 {{critical}}',
    },
  });
  assert(emailCfg.body.notifyKind === 'email', '邮件通道应保存成功');
  assert(emailCfg.body.notifySubjectTemplate.includes('{{count}}'), '主题模板应保存');

  const emailRun = await api('POST', '/api/copilot/watch/run', { cookie: seller.cookie });
  assert(emailRun.body.ran === true, '邮件模式下巡检仍应执行');
  assert(
    emailRun.body.message.includes('通知未发送') || emailRun.body.message.includes('已推送邮件'),
    `邮件不可达时应诚实降级，实际 ${emailRun.body.message.slice(-60)}`,
  );
  ok('邮件通道：配置保存 → 巡检执行 → SMTP 不可达时诚实降级不阻断');

  await api('PUT', '/api/copilot/watch', {
    cookie: seller.cookie,
    json: { enabled: false, notifyKind: 'none', notifyUrl: '' },
  });

  // ---------- 12. 批量上架体检 ----------
  const audit = await api('GET', '/api/products/audit/active?limit=200', { cookie: seller.cookie });
  assert(Array.isArray(audit.body), '体检应返回数组');
  for (const item of audit.body) {
    assert(typeof item.id === 'string' && typeof item.title === 'string', '每条应含 id/title');
    assert(Array.isArray(item.missing) && item.missing.length > 0, '不完整商品应列出缺失项');
  }
  ok(`在售商品体检：${audit.body.length} 个商品信息不完整`);

  // ---------- 13. 越权 ----------
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
