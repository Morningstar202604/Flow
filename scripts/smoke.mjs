#!/usr/bin/env node
/**
 * 端到端冒烟（CI 使用）：
 *   注册(卖家/买家) → 运费模板 → 种子商品 → 报价 → 下单 → 演示支付 → 部分退款
 *   → 优惠券折扣 → 取消回补 → 非法状态迁移拒绝 → 游客下单支付 → 累计退款上限 → 全退款与积分
 * 用法：SMOKE_BASE=http://127.0.0.1:3000 DATABASE_URL=postgres://... node scripts/smoke.mjs
 * 断言失败以非零码退出。
 */
import postgres from 'postgres';

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:3000';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[smoke] DATABASE_URL is required (用于种子数据)');
  process.exit(1);
}

const runId = Date.now().toString(36);
const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

let step = 0;
function ok(msg) {
  step += 1;
  console.log(`[smoke] ${String(step).padStart(2, '0')}. ${msg}`);
}
function assert(cond, msg) {
  if (!cond) {
    console.error(`[smoke] ASSERT FAILED: ${msg}`);
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

async function api(method, path, { cookie, sessionId, json, expect = [200, 201] } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
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
  // 0. 健康检查
  const health = await api('GET', '/api/health');
  assert(health.body?.status === 'ok', `health 应为 ok，实际 ${JSON.stringify(health.body)}`);
  ok('health = ok');

  // 1. 卖家注册 + 运费模板（卖家注册需邀请码，与服务端 SELLER_REGISTRATION_CODE 一致）
  const sellerEmail = `smoke-seller-${runId}@test.dev`;
  const sellerCode = process.env.SMOKE_SELLER_CODE ?? 'smoke-secret';
  const seller = await withAuthRetry(() => api('POST', '/api/auth/register', {
    json: { email: sellerEmail, password: 'Passw0rd1', name: 'Smoke Seller', role: 'seller', sellerCode },
  }));
  assert(seller.body?.user?.role === 'seller', '卖家注册应返回 seller 角色');
  ok('卖家注册成功');

  const template = await api('POST', '/api/shipping-templates', {
    cookie: seller.cookie,
    json: {
      name: `smoke-default-${runId}`,
      isDefault: true,
      baseFee: '5.00',
      extraFeePerUnit: '2.00',
      freeShippingThreshold: '100.00',
      unitType: 'quantity',
    },
  });
  assert(template.body?.id, '运费模板应创建成功');
  ok('运费模板创建成功（首件 5.00，续件 +2.00，满 100 免运费）');

  // 2. 种子类目/商品/变体（直连 DB，避免依赖卖家商品 API 的字段细节）
  const [category] = await sql`
    INSERT INTO categories (name_zh, name_en, slug)
    VALUES ('冒烟类目', 'Smoke Category', ${'smoke-cat-' + runId})
    RETURNING id`;
  const [product] = await sql`
    INSERT INTO products (seller_id, title_zh, title_en, category_id, status, weight)
    VALUES (${seller.body.user.id}, '冒烟商品', ${'Smoke Item ' + runId}, ${category.id}, 'active', 0.5)
    RETURNING id`;
  const [variant] = await sql`
    INSERT INTO product_variants (product_id, sku, price, stock, status)
    VALUES (${product.id}, ${'SMOKE-SKU-' + runId}, 10.00, 100, 'active')
    RETURNING id`;
  ok('种子商品创建成功（单价 10.00，库存 100）');

  // 3. 买家注册
  const buyerEmail = `smoke-buyer-${runId}@test.dev`;
  const buyer = await withAuthRetry(() => api('POST', '/api/auth/register', {
    json: { email: buyerEmail, password: 'Passw0rd1', name: 'Smoke Buyer' },
  }));
  assert(buyer.body?.user?.role === 'buyer', '买家注册应返回 buyer 角色');
  ok('买家注册成功');

  // 4. 运费报价（30 美元 3 件 → 5 + 2*2 = 9.00）
  const quote = await api('GET', '/api/shipping/quote?subtotal=30&qtyTotal=3&country=US');
  assert(quote.body?.fee === '9.00', `运费应为 9.00，实际 ${quote.body?.fee}`);
  ok('运费报价 = 9.00');

  // 5. 下单（服务端重算：小计 30 + 运费 9 = 总额 39）
  const order = await api('POST', '/api/orders', {
    cookie: buyer.cookie,
    json: {
      buyerName: 'Smoke Buyer',
      shippingAddress: '1 Test Street',
      shippingCity: 'New York',
      shippingCountry: 'US',
      paymentMethod: 'demo',
      items: [{ productId: product.id, variantId: variant.id, quantity: 3 }],
    },
  });
  assert(order.body?.subtotal === '30.00', `小计应为 30.00，实际 ${order.body?.subtotal}`);
  assert(order.body?.shippingFee === '9.00', `运费应为 9.00，实际 ${order.body?.shippingFee}`);
  assert(order.body?.totalAmount === '39.00', `总额应为 39.00，实际 ${order.body?.totalAmount}`);
  assert(order.body?.status === 'pending_payment', '新订单应为 pending_payment');
  ok('下单成功：30.00 + 9.00 = 39.00（pending_payment）');

  const stockAfterOrder = await sql`SELECT stock, sold FROM product_variants WHERE id = ${variant.id}`;
  assert(stockAfterOrder[0].stock === 97, `下单后库存应为 97，实际 ${stockAfterOrder[0].stock}`);
  assert(stockAfterOrder[0].sold === 0, `未支付前销量应为 0，实际 ${stockAfterOrder[0].sold}`);
  ok('下单锁定库存 97，销量未累计（0）');

  // 6. 演示支付（幂等入账 + 销量累计）
  const pay = await api('POST', '/api/payments/pay', {
    cookie: buyer.cookie,
    json: { orderId: order.body.id, provider: 'demo' },
  });
  assert(pay.body?.order?.status === 'paid', `支付后订单应为 paid，实际 ${pay.body?.order?.status}`);
  const afterPay = await sql`SELECT stock, sold FROM product_variants WHERE id = ${variant.id}`;
  assert(afterPay[0].stock === 97 && afterPay[0].sold === 3, `支付后 stock=97 sold=3，实际 ${JSON.stringify(afterPay[0])}`);
  ok('演示支付成功：订单 paid，销量累计 3');

  // 7. 部分退款（按金额 10 美元）
  const refund = await api('POST', `/api/orders/${order.body.id}/refunds`, {
    cookie: buyer.cookie,
    json: { amount: '10.00', reason: 'other', reasonDetail: 'smoke partial refund' },
  });
  assert(refund.body?.status === 'requested', '退款申请应为 requested');
  ok('退款申请提交（10.00）');

  const approve = await api('POST', `/api/refunds/${refund.body.id}/approve`, {
    cookie: seller.cookie,
    json: { reply: 'approved by smoke' },
  });
  assert(approve.body?.status === 'completed', `审批后应为 completed，实际 ${approve.body?.status}`);
  ok('退款审批通过（completed）');

  const [orderRow] = await sql`SELECT status FROM orders WHERE id = ${order.body.id}`;
  assert(orderRow.status === 'partially_refunded', `订单应为 partially_refunded，实际 ${orderRow.status}`);
  const [paymentRow] = await sql`SELECT status FROM payments WHERE order_id = ${order.body.id} ORDER BY created_at DESC LIMIT 1`;
  assert(paymentRow.status === 'paid', `部分退款后支付行应保持 paid，实际 ${paymentRow.status}`);
  const refundRows = await sql`SELECT count(*)::int AS n FROM refunds WHERE order_id = ${order.body.id}`;
  assert(refundRows[0].n === 1, `退款记录应恰好 1 条（无重复记账），实际 ${refundRows[0].n}`);
  const stockAfterRefund = await sql`SELECT stock, sold FROM product_variants WHERE id = ${variant.id}`;
  assert(stockAfterRefund[0].stock === 97, `金额部分退款不回补库存（97），实际 ${stockAfterRefund[0].stock}`);
  ok('部分退款核对：refunds=1 条、订单 partially_refunded、支付行 paid、库存不回补');

  // 8. 买家订单列表可见
  const buyerOrders = await api('GET', '/api/orders/buyer?page=1&pageSize=10', { cookie: buyer.cookie });
  assert(buyerOrders.body?.total >= 1, '买家订单列表应包含刚创建的订单');
  ok('买家订单列表可见');

  // 9. 优惠券：卖家建券 → 校验 → 下单折扣
  const couponCode = `SMOKE${runId.toUpperCase().slice(0, 8)}`;
  const couponRes = await api('POST', '/api/coupons', {
    cookie: seller.cookie,
    json: {
      code: couponCode,
      type: 'percent',
      value: 10,
      totalQuantity: 100,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    },
  });
  assert(couponRes.body?.id, '优惠券应创建成功');

  const validate = await api('POST', '/api/coupons/validate', {
    json: { code: couponCode, orderAmount: 30 },
  });
  assert(validate.body?.valid === true, '优惠券校验应通过');
  assert(validate.body?.discountAmount === 3, `30 元 9 折应优惠 3，实际 ${validate.body?.discountAmount}`);

  const couponOrder = await api('POST', '/api/orders', {
    cookie: buyer.cookie,
    json: {
      buyerName: 'Smoke Buyer',
      shippingAddress: '1 Test Street',
      shippingCity: 'New York',
      shippingCountry: 'US',
      paymentMethod: 'demo',
      couponCode,
      items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
    },
  });
  assert(couponOrder.body?.discountAmount === '1.00', `1 件 10 元应优惠 1.00，实际 ${couponOrder.body?.discountAmount}`);
  assert(couponOrder.body?.shippingFee === '5.00', `1 件运费应为 5.00，实际 ${couponOrder.body?.shippingFee}`);
  assert(couponOrder.body?.totalAmount === '14.00', `总额应为 14.00，实际 ${couponOrder.body?.totalAmount}`);
  ok(`优惠券闭环：10% 折扣生效（14.00 = 10 + 5 - 1）`);

  // 10. 取消订单：库存回补、优惠券释放、销量不变
  const cancelRes = await api('PATCH', `/api/orders/${couponOrder.body.id}/status`, {
    cookie: seller.cookie,
    json: { status: 'cancelled' },
  });
  assert(cancelRes.body?.status === 'cancelled', '取消后状态应为 cancelled');
  const afterCancel = await sql`SELECT stock, sold FROM product_variants WHERE id = ${variant.id}`;
  assert(afterCancel[0].stock === 97, `取消后库存应回补到 97，实际 ${afterCancel[0].stock}`);
  assert(afterCancel[0].sold === 3, `取消不影响已累计销量（3），实际 ${afterCancel[0].sold}`);
  const couponUsed = await sql`SELECT used_count FROM coupons WHERE code = ${couponCode}`;
  assert(couponUsed[0].used_count === 0, `取消后优惠券用量应释放为 0，实际 ${couponUsed[0].used_count}`);
  ok('取消订单：库存回补 97、优惠券用量释放、销量不受影响');

  // 11. 非法状态迁移拒绝（partially_refunded → delivered 不在状态机中）
  const illegal = await api('PATCH', `/api/orders/${order.body.id}/status`, {
    cookie: seller.cookie,
    json: { status: 'delivered' },
    expect: [400],
  });
  assert(typeof illegal.body?.message === 'string', '非法迁移应返回 400 与错误说明');
  ok('非法状态迁移被拒绝（400）');

  // 12. 游客下单 + 游客支付（X-Session-Id，无登录态）
  const guestSession = `smoke-guest-${runId}`;
  const guestOrder = await api('POST', '/api/orders', {
    sessionId: guestSession,
    json: {
      buyerName: 'Guest Buyer',
      shippingAddress: '2 Guest Road',
      shippingCity: 'Austin',
      shippingCountry: 'US',
      paymentMethod: 'demo',
      items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
    },
  });
  assert(guestOrder.body?.status === 'pending_payment', '游客订单应创建成功（pending_payment）');
  const guestPay = await api('POST', '/api/payments/pay', {
    sessionId: guestSession,
    json: { orderId: guestOrder.body.id, provider: 'demo' },
  });
  assert(guestPay.body?.order?.status === 'paid', `游客支付后应为 paid，实际 ${guestPay.body?.order?.status}`);
  const guestList = await api('GET', '/api/orders/buyer?page=1&pageSize=10', { sessionId: guestSession });
  assert(guestList.body?.total >= 1, '游客订单列表应能看到自己的订单');
  ok('游客下单 + 支付 + 订单列表全通（session 归属）');

  // 13. 累计退款上限：已有 10 已退，再退 39 应被拒绝
  const overRefund = await api('POST', `/api/orders/${order.body.id}/refunds`, {
    cookie: buyer.cookie,
    json: { amount: '39.00', reason: 'other' },
    expect: [400],
  });
  assert(typeof overRefund.body?.message === 'string', '超额退款应返回 400');
  ok('累计退款上限生效（已退 10，退 39 被拒）');

  // 14. 全退款（剩余 29）：订单/支付归零、库存销量回补、积分归零
  const finalRefund = await api('POST', `/api/orders/${order.body.id}/refunds`, {
    cookie: buyer.cookie,
    json: { amount: '29.00', reason: 'other', reasonDetail: 'smoke final refund' },
  });
  await api('POST', `/api/refunds/${finalRefund.body.id}/approve`, {
    cookie: seller.cookie,
    json: { reply: 'final' },
  });

  const [finalOrder] = await sql`SELECT status FROM orders WHERE id = ${order.body.id}`;
  assert(finalOrder.status === 'refunded', `全退后订单应为 refunded，实际 ${finalOrder.status}`);
  const [finalPayment] = await sql`SELECT status FROM payments WHERE order_id = ${order.body.id} ORDER BY created_at DESC LIMIT 1`;
  assert(finalPayment.status === 'refunded', `全退后支付行应为 refunded，实际 ${finalPayment.status}`);
  const afterFullRefund = await sql`SELECT stock, sold FROM product_variants WHERE id = ${variant.id}`;
  assert(afterFullRefund[0].stock === 99, `全退回补 order1 的 3 件 → 99（游客订单 1 件仍占用），实际 ${afterFullRefund[0].stock}`);
  assert(afterFullRefund[0].sold === 1, `全退扣回 order1 的 3 件 → 剩游客订单 1 件，实际 ${afterFullRefund[0].sold}`);
  const totalRefunds = await sql`SELECT count(*)::int AS n FROM refunds WHERE order_id = ${order.body.id}`;
  assert(totalRefunds[0].n === 2, `退款记录应为 2 条（10 + 29），实际 ${totalRefunds[0].n}`);

  const me = await api('GET', '/api/auth/me', { cookie: buyer.cookie });
  assert(me.body?.points === 0, `买家积分应归零（+39 -10 -29），实际 ${me.body?.points}`);
  ok('全退款闭环：订单 refunded、支付 refunded、库存/销量回补、积分归零');

  console.log('[smoke] ALL PASSED');
} catch (err) {
  console.error('[smoke] FAILED:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
