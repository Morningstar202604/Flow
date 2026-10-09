# 更新日志 / Changelog

本项目所有重要变更均记录于本文件。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [1.1.1] — 2026-10-09

死代码全量剥离 & 飞书依赖清除 — 每行代码经前向追踪，零无用声明残留。

### Changed
- README 架构图与技术栈：移除 `pgvector` 向量检索相关描述（已确认 `EmbeddingService` 全无用）
- `docker-compose.yml`：Postgres 镜像 `pgvector/pgvector:pg16` → `postgres:16-alpine`
- `docker/postgres/init.sql`：移除 `CREATE EXTENSION vector`
- `server/database/database.provider.ts`：注入 `ConfigService` 读 `DATABASE_URL`，修复 env 顺序启动崩溃

### Removed（经 grep 全项目前向追踪确认无引用）
- `server/modules/embedding/` — `EmbeddingService` 空壳（`isReady()` 永返 false，向量检索永返 `[]`）
- `server/modules/hello/` — 占位示例模块
- `server/modules/view/` — 脚手架 catch-all 路由
- `client/src/pages/ExamplePage/` — 全部注释掉的死文件
- `shared/api.interface.ts` 中 `ShopFAQ` 类型 — 从未引用
- 数据库死表：`productEmbeddings`、`inquiries`（已被 `inquirySessions`+`inquiryMessages` 取代）
- 前端 8 个从未被调用的 API 函数：买家侧 inquiry 会话、分类管理 CRUD、Google OAuth 状态、支付记录查询
- `client/src/index.tsx` 重复 `<Toaster>`
- 58 处前端 `console.info` 噪音日志

### Verification
- `tsc -p tsconfig.json` → 0 errors
- `tsc -p tsconfig.app.json` → 0 errors
- `vite build` → ✓ built in 1.73s (3019 modules)

---

## [1.1.0] — 2026-10-01

开源发布准备：文档体系全面对标成熟开源项目，项目转为 **MIT License** 开源。

### Added
- **MIT LICENSE**：项目正式开源（此前为"仅展示、版权归公司"）。
- **README 全面重写（中英双语）**：新增产品 Hero（品牌 Logo）、产品截图展示区（16 张页面截图随仓库分发，收录于 `docs/screenshots/`）、5 个 AI Agent 详表、架构总览、快速开始（Docker 一键 + 本地开发 + 演示账号）、文档目录、路线图、贡献指引、安全与 License 章节；徽章扩展至 8 枚（四平台 / 版本 / Stars / MIT / TypeScript / PRs Welcome）。
- **CONTRIBUTING.md**：贡献指南（开发环境、代码规范、提交信息格式、PR 流程、文档贡献）。
- **SECURITY.md**：安全策略（漏洞私密报告流程、处理承诺、已开展的安全基线、部署安全建议）。
- **CODE_OF_CONDUCT.md**：社区行为准则（Contributor Covenant 2.1）。
- **docs/screenshots/**：16 张真实页面截图归档（买家 8 张 + 卖家 6 张 + AI 2 张），README 与文档引用本地路径，不依赖外部 CDN 短链。

### Changed
- README 版权声明由"仅展示、不放开源许可"更新为 **MIT License** 开源。

### Verification
- README 内所有图片引用均为仓库内本地路径（`client/src/assets/branding/`、`docs/screenshots/`），可离线渲染。
- README 中所有功能描述与 `docs/` 四份文档、CHANGELOG 历史逐项核对一致，无虚构内容。

---

## [1.0.0] — 2026-09-30

品牌打磨 + 部署准备 + 收官全量审查修复，正式版本号 v1.0.0。

### Added
- 品牌资产全端应用：4 套 Logo（主标 / 反白 / 图标 / 文字标）+ 品牌色（深海军蓝 `#0B1F3A` + 科技青 `#00C2B8`）+ Favicon，覆盖买家端、卖家端、登录页与浏览器标签页。
- 部署交付物：`docker-compose.yml`、`.env.example`、`docs/DEPLOY.md`。

### Fixed（收官全量审查 7 项）
- 修复 3 处 `req.userContext.userId` 引用崩溃（`products.controller.ts` / `categories.controller.ts` / `ai.controller.ts`），统一改为 `req.user?.id` 并补空值校验。
- 修复卖家商品上下架 404：`client/api/products.ts` 的 `updateProductStatus` 复用 `updateProduct(id, { status })`，消除不存在的 `/products/:id/status` 端点。
- 修复 `.env.example` 中 `PORT=3000` 与代码 `process.env.SERVER_PORT` 不一致，统一为 `SERVER_PORT`。
- 清理 `reviews.controller.ts` / `favorites.controller.ts` 中 5 处 `as any` 类型断言。

### Verification
- 收官回归 25 项全通过：交易闭环 10/10、账号鉴权 3/3、评价/收藏/优惠券/CSV/四语言 10/10、AI 状态 1/1、安全抽查（越权 403、CSRF 403）2/2。

---

## [0.5.0] — 2026-09-30

P2 加固 4 项：认证 Cookie 化、AI 计量落库、匿名购物车跨设备同步、操作审计。

### Added
- **HttpOnly Cookie 全替代 + CSRF 头校验**：登录/注册/刷新接口仅通过 `Set-Cookie`（HttpOnly、生产 Secure、SameSite=Lax、Path=/）下发 JWT，响应体不再返回 token 明文；新增 `POST /api/auth/refresh` 滑动续期（2h）与 `POST /api/auth/logout` 清 Cookie；全局 `X-Requested-With: XMLHttpRequest` 头校验，缺失 403；前端彻底移除 localStorage token 读写，统一 `credentials: include`。
- **ai_usage_log AI 计量落库**：新建 `ai_usage_log` 表（agent / model / input_tokens / output_tokens / duration_ms / success / error_message / user_id / created_at），`ai-gateway.service.ts` 每次 LLM 调用（成功+失败）均落库；新增 `GET /api/ai/usage-stats` 聚合接口，卖家 AI 分析中心顶部展示调用次数 / 总耗时 / Token / 成功率。
- **匿名购物车跨设备同步**：新建 `cart_recovery_codes` 表（12 位随机码、24h 有效、一次性）；`GET /api/cart/export-code` 导出、`POST /api/cart/import-code` 事务内按 product_id 数量合并；买家购物车页新增"跨设备迁移码"导出/导入卡片。
- **audit_logs 操作审计**：新建 `audit_logs` 表（actor / action / target / before_value / after_value JSONB / ip）；`audit.service.log()` fire-and-forget 写入；在订单创建、订单状态变更、支付、商品改价、商品上下架、CSV 导入、优惠券创建、优惠券核销等 9 类写操作埋点；新增卖家端"操作审计日志"页面，支持筛选与 before/after 展开。

### Changed
- JWT 中间件 `forRoutes` 不支持通配，改为逐条列出约 50 条受保护路径；`register` 支持可选 `role` 参数（buyer/seller，默认 buyer）；移除 `app.module` 重复全局 JWT 中间件。

---

## [0.4.0] — 2026-09-30

安全加固 P0 致命 14 项 + P1 重要 16 项。

### Security / Fixed（P0 致命 14 项）
- **IDOR 越权修复**：订单详情、支付接口、支付记录查询、咨询消息接口均增加 userId / sessionId 归属校验，seller/admin 放行，不匹配 403。
- **支付鉴权**：demo 支付也校验订单归属，防止任意人代付。
- **PayPal Webhook 验签**：完整 RSA-SHA256 验签 + 证书 URL 白名单，验签失败拒绝。
- **优惠券并发超用**：改为原子 `UPDATE ... WHERE used_count < usage_limit RETURNING`，0 行回滚。
- **JWT_SECRET 强制**：生产环境缺失或长度 <32 字符直接抛异常拒启动；开发保留默认值 + 警告。
- **异常脱敏**：全局异常过滤器生产环境仅返 code/message/timestamp，stack 仅记服务端日志。
- **XSS 净化**：Markdown 渲染接入 DOMPurify + URL 协议白名单（仅 http/https/mailto），img 加 lazy。
- **路由守卫**：SellerRouteGuard 渲染期拦截（loading 骨架 / 未登录 Navigate / 非 seller 403），消除 useEffect 跳转窗口。
- **金额后端重算**：下单只传 productId+quantity，后端从 DB `products.price` 重算，不信任前端金额。
- **输入校验**：结算收货信息（姓名/手机正则/邮编/地址长度/支付方式枚举）zod 前后端同规则校验。
- **图片校验**：商品图片 URL 必须 http/https、≤500 字符、≤10 张；CSV ≤10MB、MIME 白名单。
- **decimal.js 精度**：订单金额、优惠券折扣全部改用 decimal.js 精确运算，保留 2 位。
- **事务化**：购物车合并、物流与订单状态变更均包裹在 db.transaction 中。
- **索引 / 限流 / 密码强度 / 通配符转义**：补 `idx_orders_created_at_status` 等索引；登录注册 IP+email 粒度每分钟 5 次限流；密码 ≥8 位且含字母+数字；商品搜索 `% _ \` 转义后按字面匹配。

### Security / Fixed（P1 重要 16 项）
- 取消订单事务内回补库存（stock+、soldCount-、优惠券 used_count 回退）。
- 购物车加购改 `INSERT ... ON CONFLICT DO UPDATE` 原子累加，消除 TOCTOU。
- Dashboard 默认 90 天时间窗聚合；订单搜索启用 pg_trgm + GIN 索引；购物车合并改批量 upsert；首页收藏检查改 `/api/favorites/check-batch` 批量接口消除 N+1。
- Google OAuth 回调完整实现（code 换 token → userinfo → 自动建号 → 签 JWT），未配 key 友好提示。
- CSV 导入 10MB 上限；订单号改用 nanoid + 日期前缀防并发碰撞。

---

## [0.3.0] — 2026-09-27

查漏补缺 12 项：账号体系、真实支付演示接入、评价/收藏/优惠券、CSV 导入、小语种、pgvector、物流接入点。

### Added
- **账号体系**：users 表 + bcrypt 哈希 + JWT 中间件 + RolesGuard（buyer/seller）+ 前端 SellerRouteGuard；购物车/订单关联 user_id，登录后合并匿名购物车。
- **Google OAuth 链路**：Google Strategy + 回调代码完整，缺密钥进入"待配置"状态，前端显示"即将上线"。
- **Stripe / PayPal 演示接入**：`payments` 表 + StripeService（PaymentIntent / webhook / 退款）+ PayPalService（create / capture / webhook），缺密钥走演示支付，订单状态流转真实。
- **商品评价**：`product_reviews` 表，已购买才能评价，详情页展示 avgRating / reviewCount。
- **收藏 / 心愿单**：`favorites` 表（联合唯一），心形按钮 + 我的收藏页。
- **优惠券**：`coupons` 表，卖家 CRUD + 结算校验 + 订单记录 coupon_id / discount_amount。
- **CSV 批量导入**：`POST /api/products/import` + 模板下载 + 成功/失败统计。
- **四语言**：新增 es / pt 翻译包，语言切换器 4 选项，商品内容回退英文。
- **pgvector 向量检索**：`product_embeddings` 表（vector(1536) + HNSW 索引），SupportAgent 升级为"向量检索优先，无 EMBEDDING_API_KEY 时回退关键词匹配"。
- **17Track 物流接入点**：`logistics` 表 + `17track.service.ts` 完整 API 代码，发货填承运商/运单号，订单跟踪页 5 节点时间线。

---

## [0.2.0] — 2026-09-25

逐模块深度检查后修复 3 个 bug。

### Fixed
- 咨询管理页 `sessions.find is not a function`：API 返回分页对象 `{items,total,...}` 被当数组使用，修正为读取 `result.items`。
- 中英语言切换点击无效：`toggleLanguage()` 只发 CustomEvent 未调 `setLanguage()`，改为直接调用 LanguageContext 的 setter。
- AI 未配置 key 时前端无友好提示：AI 分析中心加醒目提示条（列出 3 个环境变量）；客服浮窗未配置时显示引导语。

---

## [0.1.0] — 2026-09-25

MVP 交易闭环首发。

### Added
- **买家商城 6 模块**：首页（商品展示/分类导航/推荐/搜索入口）、商品列表（筛选/排序/分页/搜索）、商品详情（图片/描述/规格/加购/多语言）、购物车（增删改/数量调整/价格计算）、下单（收货信息/支付方式/订单提交）、订单跟踪（列表/详情/物流状态时间线）。
- **卖家 AI 工作台 5 模块**：运营数据看板（GMV/订单量/访客数，SQL 真实聚合）、商品管理（CRUD/上下架/库存）、订单管理（列表/状态流转/发货）、咨询管理（会话列表/回复）、AI 分析中心（5 Agent 入口）。
- **5 个 AI Agent 代码链路**：CopywriterAgent / SupportAgent / TrendAgent / SelectAgent / TranslationAgent，统一经 `ai-gateway.service.ts` 走 OpenAI 兼容协议真实调用，未配 key 诚实报错 400，不返回假数据。
- **PostgreSQL 持久化**：products / categories / orders / order_items / cart_items / inquiry_sessions / inquiry_messages / ai_reports / shop_settings 等表，行级安全 RLS。
- **买卖数据打通**：买家下单卖家可见、卖家上下架买家可见，双向实时验证。
- **中英双语**：界面 + 商品多语言字段切换。
