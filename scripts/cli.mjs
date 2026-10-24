#!/usr/bin/env node
/**
 * Flow CLI —— 面向运维与集成的零依赖命令行。
 *
 * 用法：
 *   node scripts/cli.mjs health                       # 健康检查
 *   node scripts/cli.mjs products [--limit 10]        # 列出在售商品
 *   node scripts/cli.mjs search <keyword>             # 搜索商品
 *   node scripts/cli.mjs order <orderId>              # 查询订单（需卖家 cookie）
 *   node scripts/cli.mjs ai-test                      # 测试 LLM 配置连通性（需卖家 cookie）
 *   node scripts/cli.mjs export <out.csv>             # 导出商品 CSV（需卖家 cookie）
 *   node scripts/cli.mjs openapi <out.json>           # 下载 OpenAPI 描述
 *
 * 环境变量：
 *   FLOW_BASE   API 地址（默认 http://127.0.0.1:3000）
 *   FLOW_COOKIE 卖家登录 Cookie（flow_auth=...；仅受保护命令需要）
 */
const BASE = (process.env.FLOW_BASE ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const COOKIE = process.env.FLOW_COOKIE ?? '';

function usage() {
  console.log(`Flow CLI

  node scripts/cli.mjs health
  node scripts/cli.mjs products [--limit N]
  node scripts/cli.mjs search <keyword>
  node scripts/cli.mjs order <orderId>
  node scripts/cli.mjs ai-test
  node scripts/cli.mjs export <out.csv>
  node scripts/cli.mjs openapi <out.json>

Env: FLOW_BASE=${BASE}${COOKIE ? ' FLOW_COOKIE=***' : ' FLOW_COOKIE=<seller cookie>'}`);
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  if (COOKIE) headers.Cookie = COOKIE;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (raw) {
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
    return res.text();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function requireSeller() {
  if (!COOKIE) {
    console.error('该命令需要卖家身份：请设置 FLOW_COOKIE（浏览器登录后从 DevTools 复制 flow_auth Cookie）');
    process.exit(2);
  }
}

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case 'health': {
      const data = await request('/api/health');
      console.log(`status=${data.status} db=${data.db} time=${data.time}`);
      break;
    }
    case 'products': {
      const limitFlag = args.indexOf('--limit');
      const limit = limitFlag >= 0 ? Number(args[limitFlag + 1]) : 10;
      const data = await request(`/api/products?page=1&pageSize=${Number.isFinite(limit) ? limit : 10}`);
      for (const item of data.items) {
        console.log(`${item.id}  $${item.minPrice}  stock=${item.totalStock}  ${item.titleEn}`);
      }
      console.log(`-- total ${data.total}`);
      break;
    }
    case 'search': {
      const keyword = args.join(' ');
      if (!keyword) throw new Error('缺少关键词');
      const data = await request(`/api/products?page=1&pageSize=20&keyword=${encodeURIComponent(keyword)}`);
      for (const item of data.items) console.log(`${item.id}  $${item.minPrice}  ${item.titleEn}`);
      console.log(`-- ${data.total} matches`);
      break;
    }
    case 'order': {
      requireSeller();
      const orderId = args[0];
      if (!orderId) throw new Error('缺少 orderId');
      const order = await request(`/api/orders/${orderId}`);
      console.log(JSON.stringify({
        orderNo: order.orderNo,
        status: order.status,
        total: order.totalAmount,
        buyer: order.buyerName,
        items: order.items.length,
      }, null, 2));
      break;
    }
    case 'ai-test': {
      requireSeller();
      const result = await request('/api/ai/settings/test', { method: 'POST' });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'export': {
      requireSeller();
      const out = args[0] ?? 'products-export.csv';
      const csv = await request('/api/products/export/csv', { raw: true });
      const { writeFile } = await import('node:fs/promises');
      await writeFile(out, csv, 'utf8');
      console.log(`已导出 ${out}（${csv.split('\n').length - 1} 行）`);
      break;
    }
    case 'openapi': {
      const out = args[0] ?? 'openapi.json';
      const spec = await request('/api/openapi.json');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(out, JSON.stringify(spec, null, 2), 'utf8');
      console.log(`已导出 ${out}`);
      break;
    }
    default:
      usage();
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(`[flow] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
