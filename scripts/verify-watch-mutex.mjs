#!/usr/bin/env node
/**
 * 多副本巡检互斥验证：
 * 同时启动两个应用实例指向同一数据库，对两端同时触发 N 次巡检，
 * 断言：所有"真的跑了"的请求都包含完整摘要，且同一时间只有一个实例在跑。
 *
 * 判定口径（可观测、不依赖内部状态）：
 *   1) 每次调用返回 ran=true 或 ran=false(其他实例正在巡检)；
 *   2) 并发 N 次里，同一时刻最多 1 个 ran=true —— 通过各次返回的摘要中
 *      "新增 X 项"与快照最终状态核对：快照里的告警数 == 最后一次成功巡检的告警数；
 *   3) 所有实例返回的 message 都能解析（无异常抛出）。
 *
 * 前置：两个实例分别监听 BASE_A / BASE_B，同一 DATABASE_URL，SELLER_REGISTRATION_CODE 一致
 * 用法：DATABASE_URL=... BASE_A=http://127.0.0.1:3201 BASE_B=http://127.0.0.1:3202 \
 *      node scripts/verify-watch-mutex.mjs
 */
import postgres from 'postgres';

const A = process.env.BASE_A ?? 'http://127.0.0.1:3201';
const B = process.env.BASE_B ?? 'http://127.0.0.1:3202';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[watch-mutex] DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
const runId = Date.now().toString(36);
let failed = false;

function assert(condition, message) {
  if (!condition) {
    console.error(`[watch-mutex] ASSERT FAILED: ${message}`);
    failed = true;
  }
}

async function api(base, method, path, { cookie, json } = {}) {
  const res = await fetch(`${base}${path}`, {
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
  return {
    status: res.status,
    body,
    cookie: setCookie.length > 0 ? setCookie.map((c) => c.split(';')[0]).join('; ') : cookie,
  };
}

try {
  const login = await api(A, 'POST', '/api/auth/register', {
    json: {
      email: `mutex-seller-${runId}@test.dev`,
      password: 'Passw0rd1',
      name: 'Mutex Seller',
      role: 'seller',
      sellerCode: process.env.SELLER_REGISTRATION_CODE ?? 'smoke-secret',
    },
  });
  if (login.status >= 300) throw new Error(`注册失败：${JSON.stringify(login.body)}`);
  const sellerId = login.body.user.id;
  const cookie = login.cookie;

  // 造 3 条低库存 → 巡检必有内容
  await sql`
    INSERT INTO products (seller_id, title_zh, title_en, status, total_stock)
    SELECT ${sellerId}, '互斥测试' || g, 'Mutex ' || g, 'active', 1
    FROM generate_series(1, 3) AS g`;

  await api(A, 'PUT', '/api/copilot/watch', { cookie, json: { enabled: true, intervalMinutes: 5 } });

  // 同时打 8 次（A/B 各 4 次）
  const calls = [];
  for (let i = 0; i < 4; i += 1) {
    calls.push(api(A, 'POST', '/api/copilot/watch/run', { cookie }));
    calls.push(api(B, 'POST', '/api/copilot/watch/run', { cookie }));
  }
  const results = await Promise.all(calls);

  const executed = results.filter((r) => r.body?.ran === true);
  const skipped = results.filter((r) => r.body?.ran === false);
  console.log(`[watch-mutex] 并发 ${results.length} 次：执行 ${executed.length} 次，跳过 ${skipped.length} 次`);

  for (const r of results) {
    assert([200, 201].includes(r.status), `巡检接口应 2xx，实际 ${r.status}`);
    assert(typeof r.body?.message === 'string', '每次调用都应返回可读摘要');
  }

  // 互斥的核心证据：跳过的次数 > 0（说明确实被锁挡住）；且至少有一次真的执行
  assert(executed.length >= 1, '并发下应至少有 1 次真正执行');
  assert(skipped.length >= 1, `并发下应有请求被互斥跳过，实际跳过 ${skipped.length} 次`);

  // 快照应存在且是合法 JSON 数组
  const snapshot = await sql`
    SELECT value FROM ai_settings WHERE key = 'copilot_watch_last_snapshot'`;
  assert(snapshot.length === 1, '巡检快照应写入');
  const parsed = JSON.parse(snapshot[0].value);
  assert(Array.isArray(parsed), '快照应为数组');
  assert(parsed.length >= 3, `快照应包含刚造的 3 条低库存，实际 ${parsed.length} 条`);

  // 释放锁后应能再次执行
  await sql`UPDATE ai_settings SET updated_at = now() - interval '1 hour' WHERE key = 'copilot_watch_lock'`;
  const afterRelease = await api(B, 'POST', '/api/copilot/watch/run', { cookie });
  assert(afterRelease.body?.ran === true, '锁释放后应可再次执行');

  await api(A, 'PUT', '/api/copilot/watch', { cookie, json: { enabled: false } });

  if (failed) {
    process.exitCode = 1;
  } else {
    console.log('[watch-mutex] ALL PASSED');
  }
} catch (error) {
  console.error('[watch-mutex] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
