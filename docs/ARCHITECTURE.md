# GlobalEcom AI — 架构说明

| 项 | 内容 |
|---|---|
| 应用 | GlobalEcom AI 出口电商平台（AI 原生跨境出货台） |
| 版本 | v1.0.0 / 2026-09-30 |
| 仓库形态 | Monorepo（client + server + shared + scripts） |

---

## 一、整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                        浏览器（用户）                          │
│  ┌──────────────────────┐      ┌──────────────────────────┐  │
│  │   买家商城 (B2C)      │      │  卖家 AI 工作台 (Seller)  │  │
│  │  React 19 + Vite     │      │  React 19 + Vite         │  │
│  │  Tailwind + shadcn/ui │      │  + ECharts 看板          │  │
│  └─────────┬────────────┘      └────────────┬─────────────┘  │
│            │   credentials: include (HttpOnly Cookie)        │
└────────────┼─────────────────────────────────┼───────────────┘
             ▼                                 ▼
┌──────────────────────────────────────────────────────────────┐
│            NestJS 12 API 网关（单一 Node 进程）                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Middleware: jwt-auth → csrf-header → rate-limit      │  │
│  │  Guards: RolesGuard (buyer/seller)                    │  │
│  │  Filter: 全局异常脱敏过滤器                             │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌─────────────┬─────────────┬─────────────┬───────────────┐ │
│  │  Auth       │  Products   │  Orders     │  Payments     │ │
│  │  (JWT+OAuth)│  Categories │  Cart       │  Coupons      │ │
│  │  Reviews    │  Favorites  │  Logistics  │  Inquiry      │ │
│  │  Dashboard │  Audit      │  AI (5 Agent+Gateway)        │ │
│  └─────────────┴─────────────┴─────────────┴───────────────┘ │
└──────────────┬──────────────────────────────┬────────────────┘
               │                              │
               ▼                              ▼
   ┌──────────────────────┐      ┌──────────────────────────────┐
   │  PostgreSQL 16       │      │  外部 OpenAI 兼容 LLM 端点    │
   │  + pg_trgm (GIN)      │◄────►│  (DeepSeek / 火山方舟 / ...) │
   │  + pg_trgm            │      │  - /v1/chat/completions      │
   │  Drizzle ORM          │      │  - /v1/embeddings            │
   └──────────────────────┘      └──────────────────────────────┘
               ▲
               │
   ┌───────────┴────────────┐
   │  Stripe / PayPal /    │
   │  17TRACK / Google OAuth│
   └───────────────────────┘
```

---

## 二、Monorepo 目录分层

```
GlobalEcom-AI/
├── client/        # React 19 + Vite 前端（买家端 + 卖家端双端同仓）
│   └── src/
│       ├── pages/         # 买家 8 页面 + 卖家 7 页面
│       ├── components/     # shadcn/ui 基础组件 + 业务组件
│       ├── api/           # fetch 封装（credentials: include）
│       ├── contexts/      # AuthContext / LanguageContext
│       └── i18n/          # zh / en / es / pt 四语言
├── server/        # NestJS 12 后端
│   └── src/
│       ├── modules/       # 16 个业务模块（auth/products/orders/...）
│       ├── common/        # middleware / guards / filters
│       └── database/      # Drizzle schema
├── shared/        # 前后端共享 TypeScript 类型与 DTO 接口
├── scripts/       # 运维脚本（种子数据 / 备份等）
├── docker/        # postgres init.sql（建扩展）
├── docker-compose.yml
└── .env.example
```

---

## 三、前后端分层

### 前端（client/）
- **路由层**：React Router v6，买家端 `/`、卖家端 `/seller/*` 由 `SellerRouteGuard` 渲染期拦截。
- **数据层**：`src/api/*.ts` 统一 `fetch(..., { credentials: include, headers: { 'X-Requested-With': 'XMLHttpRequest' } })`，token 完全不落地 localStorage。
- **状态层**：`AuthContext`（当前用户）、`LanguageContext`（四语言切换）。
- **UI 层**：Tailwind CSS + shadcn/ui 原子组件 + ECharts 图表。

### 后端（server/）
- **入口**：NestJS `AppModule` 注册业务模块 + 全局中间件。
- **中间件链**：`jwt-auth.middleware`（从 HttpOnly Cookie 或 Authorization 头解析 JWT，挂 `req.user`）→ `csrf-header.middleware`（非 GET 强制 `X-Requested-With`）→ 业务路由。
- **守卫**：`RolesGuard` 按 `@Roles('seller')` 装饰器校验；买家接口默认登录态即可。
- **异常**：`exception.filter.ts` 生产环境剥离 stack，仅返 `{ code, message, timestamp }`。
- **ORM**：Drizzle ORM，启动时自动同步表结构；金额计算统一 `decimal.js`。

---

## 四、数据库表（PostgreSQL 16）

| 分组 | 表 | 说明 |
|---|---|---|
| 账号 | `users` | id / email / password_hash(bcrypt) / role(buyer\|seller) / google_id / created_at |
| 商品 | `products` | 多语言字段（title_zh/en/es/pt 等）/ price(decimal) / stock / status(active\|inactive) / images |
| 商品 | `categories` | 分类树 |
| 商品 | `product_embeddings` | `vector(1536)` + HNSW 余弦索引，供 SupportAgent 向量召回 |
| 交易 | `cart_items` | user_id 或 session_id 双轨，匿名登录后事务合并 |
| 交易 | `orders` / `order_items` | order_no(nanoid+日期前缀) / status / 金额后端重算 |
| 交易 | `payments` | channel(stripe\|paypal\|demo) / status / 第三方交易号 |
| 营销 | `product_reviews` | 仅已购用户可评，avgRating/reviewCount 冗余在 products |
| 营销 | `favorites` | (user_id, product_id) 联合唯一 |
| 营销 | `coupons` | 原子核销 `UPDATE ... WHERE used_count < usage_limit` |
| 客服 | `inquiry_sessions` / `inquiry_messages` | 买家咨询会话，卖家可见 |
| 物流 | `logistics` | carrier / tracking_no / 轨迹节点，17TRACK 接入点 |
| AI | `ai_reports` | TrendAgent 生成的趋势报告落库 |
| AI | `ai_usage_log` | 每次 LLM 调用计量（token / 耗时 / 成功率） |
| 审计 | `audit_logs` | 9 类写操作前后值 diff + IP |
| 审计 | `cart_recovery_codes` | 匿名购物车跨设备迁移码（24h 一次性） |

扩展：`pg_trgm` + GIN 索引（商品标题模糊搜索）。

---

## 五、AI Gateway 调用链路

```
Controller (5 Agent 之一)
    │  构造 messages[] + response_format? + temperature
    ▼
AiGatewayService.chat()
    │  POST {LLM_BASE_URL}/v1/chat/completions
    │  Headers: Authorization: Bearer {LLM_API_KEY}
    │  Body: { model, messages, response_format?, temperature }
    ▼
OpenAI 兼容端点（DeepSeek / 火山方舟 / OpenAI / 通义 / 智谱 ...）
    │
    ▼
解析 choices[0].message.content → JSON.parse（若要求 JSON）
    │
    ├──► 成功：logUsage(success=true, tokens, duration_ms) → ai_usage_log
    └──► 失败：logUsage(success=false, error_message) → 仍落库，向 Controller 抛 400/500
```

- **未配 `LLM_API_KEY`**：Gateway 在调用前即返回 400「未配置 LLM API Key」，**绝不返回假数据**。
- **Embedding**：SupportAgent 优先用 `EMBEDDING_API_KEY` 走 `text-embedding` 接口 + pgvector 向量检索；未配则回退 products 表 `ILIKE` 关键词匹配。

---

## 六、认证与 CSRF 方案

| 层 | 机制 |
|---|---|
| 登录 | `POST /api/auth/register` / `/login`：bcrypt 校验 → 签发 JWT（2h）→ **仅** `Set-Cookie: token=...; HttpOnly; Secure(生产); SameSite=Lax; Path=/` |
| 前端 | 彻底移除 localStorage token，所有 fetch 带 `credentials: include` |
| 鉴权中间件 | 全局 `jwt-auth.middleware` 优先读 Cookie，兼容 `Authorization: Bearer`；未匹配则 401 |
| CSRF | 全局 `csrf-header.middleware`：所有非 GET 请求必须带 `X-Requested-With: XMLHttpRequest`，缺失 403 |
| 续期 | `POST /api/auth/refresh` 校验旧 Cookie 后滑动签发新 2h Cookie |
| 登出 | `POST /api/auth/logout` 调 `clearAuthCookie` |
| 角色 | `RolesGuard` + 前端 `SellerRouteGuard`（渲染期拦截，无跳转窗口） |

> 该方案下 XSS 无法窃取 token（HttpOnly），跨站表单提交无法伪造（CSRF 头校验），token 有效期仅 2h 缩小暴露窗口。
