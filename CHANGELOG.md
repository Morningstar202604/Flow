# 更新日志 / Changelog

本项目所有重要变更均记录于本文件。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [1.9.0] — 2026-10-15

收尾：移动端适配、错误可观测、地址簿接线、自动化截图与演示视频。

### Added（展示资产 · 全部自动化生成）
- `scripts/capture/screenshots.mjs` + `npm run capture`：Puppeteer 全页截图（1440 宽，本机 Chrome 复用，不下载浏览器）
- `scripts/capture/record-demo.mjs` + `npm run capture:video`：CDP screencast 抓帧 → ffmpeg 合成 **90 秒演示视频**（1280×720 H.264）与 README 内联 GIF
- `scripts/capture/seed-demo.mjs`：截图/录屏专用演示数据（6 个带图商品、6 笔订单含 1 笔待审批退款、3 个首页楼层集合、3 张优惠券、2 个 CMS 页面、评价/咨询/地址/收藏/购物车/审计）
- `client/public/demo/*.png`：演示商品图（此前无图，截图中商品是灰色占位块）
- **截图从 16 张扩到 27 张**：补齐此前从未被截图的集合楼层、集合详情、收藏、地址、优惠券、退款、运费模板、集合管理、CMS、审计日志；全部为 **Flow** 新品牌
- `docs/social-preview.png` 重制为新品牌（原图是旧 GlobalEcom 横版 logo，且内容是 JPEG 伪装成 .png）

### Fixed
- **地址簿接口契约错位**（既有 bug）：`getAddresses()` 读 `data.items`，后端实际返回裸数组 → `undefined.length` 使 `/addresses` 与 `/checkout` 白屏崩溃；现做形状兼容
- **结算页不复用地址簿**：地址簿全站无入口（`/addresses` 无任何链接指向）且结算页不读取已存地址 → 买家端用户菜单与移动端抽屉加入口；结算页自动预填默认地址并支持一键切换
- **移动端完全无导航**：买家端 `<768px` 导航/搜索/卖家中心全隐藏，卖家端侧栏写死 `w-60` 导致手机不可用 → 两端均接入 `Sheet` 抽屉导航
- **21 处错误被静默吞掉**：`catch` 只 `console.error`，用户看到"空列表/点了没反应/加载不出"，把网络故障伪装成无数据 → 新增统一 `notifyError`，11 个页面补齐用户可见反馈；地址页区分"加载失败"与"确实为空"
- `AICenterPage` 的 Agent 弹窗缺高度约束（小屏保存按钮被推出视口）
- `CmsPageView` 用原生 `<a href="/">` 导致整页刷新丢 SPA 状态 → 改用 `<Link>`
- `ChatWidget` 滚动失效（`ScrollArea` 的滚动容器是 viewport，设 `scrollTop` 无效）→ 改用 `scrollIntoView`
- 买家端「申请退款」按钮无状态门控（待付款/已取消也能点）且提交后无成功反馈
- `client/src/App.tsx` 与 `app.tsx` 大小写重复（Linux CI 下有导入歧义）
- `<html lang>` 静态写死 `zh` 且默认语言为 `en`，现按语言运行时同步；默认语言改为跟随浏览器

### Changed（i18n 收口）
- 新增 `t.address.*`（46 键 × 4 语，此前地址页 236 个中文字符零 i18n）与退款相关文案（`requestRefund` / `refundSubmitted` / `common.lastUpdated`）
- 新增 `client/src/utils/locale.ts`：`getLocale` / `formatDateTime` / `formatDate` / `pickLocalized`（类目·集合·CMS 内容仅中英双语，西/葡统一回退英文，行为显式可预期）
- 新增 `client/src/lib/error-feedback.ts`：统一错误出口（含后端 message 提取）

### Verification
- lint 0 问题 / 双端 strict typecheck 0 错误 / 单测 52/52 / 构建通过
- 全新 compose 部署 healthy
- 截图脚本可复跑（27/27 成功）；视频 1 分 10 秒、1.8MB、ffmpeg 校验无错误

---

## [1.8.0] — 2026-10-15

品牌更名 **GlobalEcom AI → Flow**（更简短好记），并修复全量审查发现的问题。

### Changed
- **产品更名**：用户可见品牌统一为 **Flow**（`Flow — 让跨境生意更简单`），仓库名与远程地址保持不变
  - 界面：页头/侧栏 logo alt、首页 hero、登录注册页、页脚公司/入驻文案、版权行
  - 标识符：Cookie `globalecom_auth`→`flow_auth`、`globalecom_oauth_state`→`flow_oauth_state`；localStorage `globalecom_*`→`flow_*`（user / session_id / language / last_visit_date）；JWT 开发默认密钥 → `flow-dev-*`
  - 工程：package 名 `globalecom-ai`→`flow`（含 lockfile）、Docker 容器名与默认库/用户/密码 `globalecom*`→`flow*`（仍可用环境变量覆盖，不破坏既有部署）、CI 与 `.env.example`、`drizzle.config.ts` 默认连接串同步
  - 文档：README / AGENTS / CONTRIBUTING / SECURITY / LICENSE / docs 全部更新

### Fixed
- **`client/index.html` 残留模板占位**：`JSON.parse('{{{__platform__}}}')` 未被构建替换，每次页面加载都抛错（且全仓无任何使用方）→ 删除该段脚本
- **favicon 生产环境 404**：`<link rel="icon">` 指向源码路径 `/src/assets/branding/logo-icon.png` → 改为 `/favicon.svg`（已在 `client/public/` 中并正确打包）

### Docs
- `AGENTS.md`：修正过期技术栈（NestJS 10 → 12 / Express 5 + strict）；补齐模块清单（集合详情、退款管理、CSV 导入、运营楼层）；**更正数据库表清单**（原文档列出的 `product_images`、`shop_settings` 并不存在，现按 schema 实际 35 张表分组列出）；新增 AI 配置优先级、无 Key 降级、自定义 Agent、模型适配要点与验证入口
- `.gitignore`：补充 `.serena/`、浏览器截图 profile 与本地验证残留

### Verification
- `npm ci`（包名变更后重装）→ lint 0 问题 → 双端 strict typecheck 0 错误 → 单测 52/52 → 构建通过
- 全新 compose 部署 healthy → 三条冒烟全过：`smoke-workflows` 16 步 / `smoke-ai-degraded` 6 步 / `smoke` 19 步
- 无头浏览器复核首页与集合详情：品牌名渲染正确、favicon 200、无控制台报错

---

## [1.7.1] — 2026-10-15

真实大模型实测：五 Agent 全链路对接国产模型（云知声 u2-flash）跑通，修复思考型模型适配。

### Fixed（真实模型实测暴露）
- **思考型模型输出被截断**：reasoning 类模型（云知声 u2-flash / DeepSeek-reasoner 等）先输出大段思维链，原 max_tokens（1500）下正文尚未开始即被截断（`finish_reason=length`、`content` 为空）。网关现按模型名自动将思考型模型的预算提升至 ≥6000，各 Agent 仍只声明"答案需要多少 token"
- **响应字段差异容错**：部分网关把正文放在 `reasoning_content` / `output_text` / `text` 而非 `content`，网关按 `content → reasoning_content → output_text → text` 顺序取首个非空值
- 截断错误信息明确化：区分"被 max_tokens 截断（建议提高预算或改用非思考模型）"与"返回为空"

### Verified（真实模型端到端，非 mock）
使用本地直连的国产模型端点（OpenAI 兼容）完成实测：
- 连通测试：`{"ok":true,"model":"u2-flash"}`
- **商品文案**：生成专业英文标题 + 5 条卖点（结构化 JSON 正确解析）
- **多语言翻译**：中→日准确（"この折りたたみウォーターカップは…"）、中→西准确
- **智能客服**：正确引用店铺政策（30 天无理由退换），三层检索生效
- **选品建议**：基于类目+热销数据输出 6 个差异化选品方向
- **趋势分析**：基于真实 SQL 聚合输出 2061 字报告，落库且历史可回看
- **用量统计**：9 次调用按 Agent 分别入账（token/成功率真实计量）

---

## [1.7.0] — 2026-10-15

买家端运营楼层 + 集合详情页：卖家建的集合真正出现在前台。

### Added
- **首页运营楼层**：卖家标记为「首页推荐」的集合自动成为首页楼层，横向滚动展示集合内商品（一次查询取回集合+商品+变体，不随集合数增长）
  - 楼层标题/描述按当前语言自动切换（zh/en/es/pt）
  - 楼层右上角「查看全部」进入集合详情
- **集合详情页**（`/collections/:slug`，买家公开）：渐变头部 + 集合信息 + 全部上架商品网格，支持收藏
- 后端公开端点：`GET /api/collections/storefront`（楼层）、`GET /api/collections/by-slug/:slug`（详情）、`GET /api/products/by-ids?ids=`（批量商品）
- 商品图优雅占位：空图或加载失败时展示占位图形，取代破图图标（全站商品卡受益）

### Changed
- 首页数据加载合并为一次并发请求（分类、热销、新品、楼层），并统一收藏状态批量查询
- 楼层/详情复用 `ProductsService` 的完整商品映射（含变体），确保楼层商品可直接加购

### Verification
- `smoke-workflows` 扩至 16 步并覆盖楼层/详情/批量商品（含"楼层商品必须是含变体的完整对象"断言）
- 视觉验收：无头浏览器截图核对首页楼层与集合详情页渲染（含无图商品的占位降级）

---

## [1.6.0] — 2026-10-14

全工作流实测：把"跑不通的工作流"逐个跑通（16 步端到端 + 5 个真实断裂点修复）。

### Fixed（真实断裂点，均由端到端冒烟暴露）
- **商品集合模块从未被注册**：`CollectionsModule` 不在 AppModule，`/api/collections/*` 全部 404，卖家集合页与首页运营楼层完全不可用
- **集合契约错位**：后端/数据库用 `titleZh/titleEn/descriptionZh/coverImage`，shared 契约与前端却用 `name/description/image`，卖家"新建集合"必然 400
- **CMS 契约错位**：数据库为双语 `title_zh/title_en/content_zh/content_en/is_published`，而服务层 DTO、shared 契约、买卖两端页面全用单语 `title/content/status/isPublic`，CMS 页面创建必然 400，买家页字段也不存在
- **CMS 列表过滤与搜索失效**：前端传 `status=draft|published` + `keyword`，后端只认 `isPublished` 且不支持 keyword，发布态筛选与搜索框形同虚设
- **CSV 批量导入必然失败**：`cover_image` 为 NOT NULL，导入却写 null → 全事务回滚，所有行报"数据库写入失败"
- **界面建商品无法下单**：界面创建只填价格/库存不建变体，而购物车/下单走变体 → 库存扣不动；同时界面编辑的价格/库存被静默丢弃
- **购物车迁移码恢复 500**：`ON CONFLICT (session_id, product_id, variant_id)` 无对应唯一约束，跨设备购物车恢复（README 宣传能力）必然 500
- **登录合并购物车 500 且丢规格**：同样 ON CONFLICT 问题，且并入时丢弃 `variantId`

### Added
- `scripts/smoke-workflows.mjs`（16 步、零凭据依赖）：认证/购物车/收藏/地址/商品(含变体)/CSV/搜索/履约/物流/评价/集合/CMS/咨询/看板/审计/越权拦截，全部端到端断言；CI 中与降级冒烟、业务冒烟、渠道冒烟同实例执行
- 商品创建 DTO 支持 `variants`（嵌套校验）；无变体时自动生成默认变体，与 CSV 导入口径一致
- 界面编辑商品的价格/库存同步到（唯一）变体并重算聚合库存；无变体商品自动补建
- CMS 列表支持 `status`（published/draft）与 `keyword`（中英标题+slug）过滤；买家 CMS 页按当前语言择一渲染

### Verification
- `smoke-workflows` 16/16 ALL PASSED；`smoke` 19/19；`smoke-ai-degraded` 6/6；`smoke-providers` 18/18；单测 52/52；lint 0；双端 strict TS 0 错误

---

## [1.5.1] — 2026-10-14

Key 全凭商家自选：多服务商预填、无 Key 全功能照常运行（并用冒烟钉死）。

### Added
- 模型设置新增**服务商一键预填**：DeepSeek / 通义千问 / 智谱 GLM / OpenAI / 火山方舟（Key 用商家自己的账号；也可手填任意 OpenAI 兼容端点）
- `scripts/smoke-ai-degraded.mjs` + CI 步骤：在**无任何模型 Key** 的实例上验证——AI 端点统一诚实拒绝（含计量如实记录失败）、设置与 Agent 管理可用、核心交易闭环照常（CI 中与 19 步业务冒烟同实例执行）
- 买家侧客服组件未配置时禁用输入并显示「智能客服暂未开放」（四语言）

### Fixed
- **非 v1 版本路径服务商被拼错端点**：网关由"总是追加 /v1/chat/completions"改为智能组装（`buildChatCompletionsUrl`）——智谱 `/api/paas/v4`、火山方舟 `/api/v3`、通义 compatible-mode 等路径现在都能正确拼出 `/chat/completions`（R14 契约测试 4 组 10 断言）

### Verification
- 单测 52/52；无 Key 降级冒烟 6/6 ALL PASSED + 同实例 19 步业务冒烟 ALL PASSED；providers 18 步回归 ALL PASSED；compose 部署回归通过

---

## [1.5.0] — 2026-10-14

模型配置自有化 + 自定义 Agent：卖家在界面里填模型、建自己的 Agent，未配置时全站诚实提示。

### Added
- **模型设置（界面配置）**：卖家工作台「AI 分析中心 → 模型设置」填写 Base URL / API Key / 模型名；保存即生效（网关按调用解析配置，无需重启）；Key 永不明文回显（掩码 `sk-****1234`）；支持一键清除回退；「测试连通」真实调用模型并回显上游 HTTP 状态（401=Key 错 / 404=BaseURL 或模型名错）
- **配置优先级**：界面设置（DB）> 环境变量（引导默认值）> 未配置；字段级合并；变更写审计（只记掩码）
- **自定义 Agent**：任意数量用户自建 Agent（系统提示词 + `{{input}}` 模板渲染 + 文本/JSON 输出 + temperature/maxTokens + 启停），创建后可立即试跑；JSON 模式自动解析；用量独立入账（`custom:<slug>`）并出现在用量统计
- 内置 5 个 Agent 在「我的 Agent」中只读展示（各带专属数据管线），与自定义 Agent 并列
- 统一诚实提示 `LLM_NOT_CONFIGURED_MESSAGE`：未配置时所有 AI 端点、卖家横幅、客服组件使用同一文案口径——「请填写模型」，绝不返回假数据
- `ai_settings` / `ai_agents` 两张表 + 迁移 `0001`；settings/agents 接口全部 seller 鉴权

### Changed
- AI 网关重构：配置从构造期缓存改为按调用解析（`resolveConfig`，纯函数 `resolveLlmConfig` 承载优先级逻辑并有单测锁定）
- 上游失败信息回显 HTTP 状态，便于在模型设置页定位问题
- 买家侧客服组件未配置时保持既有"配置中"提示（不引导买家去配置）

### Verification
- 单测 48/48（新增：配置优先级/掩码/模板渲染 R12、网关诚实拒绝 R13）
- `smoke-providers` 扩至 18 步 ALL PASSED：模型设置链路（env→db→掩码→连通测试→清除回退）、自定义 Agent 全生命周期（创建→模板贯穿→JSON 解析→用量入账→停用拒绝→删除）+ 原有 5 Agent 与 Stripe/PayPal 钱链路

---

## [1.4.0] — 2026-10-14

渠道联调闭环：内置本地渠道模拟器，AI 与支付链路在无真实凭据下完成全链路实测。

### Added
- `scripts/mock-providers.mjs` 本地渠道模拟器（联调/CI 专用，非生产代码）：同时扮演 Stripe（payment_intents / refunds）、PayPal（oauth token / checkout orders / captures refunds）与 OpenAI 兼容 LLM，并支持以**真实 HMAC 签名**回调应用的 Stripe webhook
- `scripts/smoke-providers.mjs` 渠道全链路冒烟（13 步）：五个 AI Agent（文案 JSON / 翻译 / 选品 / 趋势落库回看 / 客服会话落库 / 用量统计 5/5 入账）+ Stripe（intent → 签名 webhook 幂等入账 → 全额退款渠道调用）+ PayPal（下单 → capture 退款出款，含金额/币种/Bearer 断言）
- CI 新增 `providers` job：Postgres service + 模拟器 + 应用 + 全链路断言，每次提交自动执行
- `STRIPE_API_BASE` / `PAYPAL_API_BASE`：API 基址覆盖（对接代理或联调环境；默认官方地址，生产安全性不变）
- PayPal 证书拉取抽为 `loadWebhookCert` protected 缝：单测注入本地密钥对覆盖验签全路径（篡改/证书域注入/缺头/错算法/多场景），生产仍只信任 PayPal 官方域
- 共享 `parseLlmJson`（剥离代码围栏 + 502 明确报错），SelectAgent 补上此前缺失的容错解析

### Fixed
- **支付流水"pending 与 paid 并存"**：渠道预建 pending 流水（Stripe intent / PayPal order）在 webhook 入账时就地升级为 paid（由模拟器真实回调链路暴露）
- 模拟 LLM 分类器对 select 提示词的误判（上下文数据含 `titleEn` 字样，改用各 Agent 独有输出字段判别）

### Verification
- 单测 37/37（新增 PayPal 验签 R10 / 退款 R11 契约）
- `smoke-providers` 13 步 ALL PASSED；常规 19 步冒烟与 compose 部署回归不受影响

---

## [1.3.0] — 2026-10-14

技术债清算与现代化：类型安全基线、测试纵深、依赖升级、CI 强化。

### Added
- 双端 TypeScript strict 模式全量开启（服务端修复 32 处空值收窄/类型建模问题，客户端零存量问题）
- 单元测试扩展至 30 例：订单状态机（合法/非法迁移矩阵）、Stripe webhook 验签（自签 HMAC：篡改/过期/轮换多签名/缺字段）、优惠券折扣口径（percent 舍入/fixed/封顶/浮点）
- 覆盖率工具链（@vitest/coverage-v8），CI 上传 lcov 产物（纯逻辑模块 100%；数据库链路由 19 步端到端冒烟覆盖）
- 优惠券批量生成端点（POST /api/coupons/generate-bulk，此前服务层方法无路由）
- 端到端冒烟从 13 步扩到 19 步：优惠券闭环、取消订单库存/券量回补、非法状态迁移拒绝、游客下单（session 归属）、累计退款上限、全退款库存/销量/积分对账
- i18n：买家端新增「运费/积分」文案补齐 zh/en/es/pt 四语；买家头部展示会员积分

### Changed
- 依赖升级：NestJS 10 → 12（Express 5）；@nestjs/{common,core,platform-express,jwt,throttler,axios} 全部升级至兼容最新版
- 请求校验：cart（增改/迁移码）、reviews、payments、coupons（建/改/校验/批量）接入 class-validator DTO（配合全局 ValidationPipe 的 whitelist/forbidNonWhitelisted 真正生效）
- 退款状态机：partially_refunded 订单允许继续申请剩余退款（申请与审批两端均执行累计上限校验，fail fast）
- 订单状态迁移判定抽为纯模块 `order-status.ts`；优惠券折扣抽为纯模块 `coupon-discount.ts`
- 优惠券/退款控制器客户端 IP 统一取 `req.ip`（反代场景由 TRUST_PROXY 控制），不再直接信任 XFF

### Removed
- 死依赖：@nestjs/swagger、@nestjs/config、@tanstack/react-query、pg、@types/pg（全库零引用）

### Verification
- `npm ci`（全新 lockfile）→ lint 0 错误 → 双端 strict typecheck 0 错误 → 30/30 单元测试 → 完整构建
- 对全新数据库执行迁移后跑 19 步冒烟：ALL PASSED（Nest 12 / Express 5 运行时验证，含静态托管与中间件链路无回归）

---

## [1.2.0] — 2026-10-14

全量重构：修复不可运行的生产路径，补齐支付/退款闭环，安全基线落地，文档与实现对齐。

### Fixed（阻断级）
- `npm ci` / `npm install` 干净检出即可安装（升级 react 19 不兼容的 Radix 老版本；lockfile 重建为公共 registry）
- 编译产物启动路径修复（入口 `dist-server/server/main.js`；消除运行时无法解析的路径别名）
- Docker 镜像可构建（`npm ci` 多阶段；Debian 基础镜像避免 bcrypt 原生编译问题）；容器同进程托管前端（SPA 回退）与 `/api/health`
- 生产环境浏览器端 API 全部可用（统一单层 `/api` 前缀，移除 `/api/api` 双前缀；`VITE_API_BASE_URL` 语义修正）
- 数据库迁移机制（`scripts/db/migrate.mjs` + `drizzle/` 迁移文件，启动时自动执行；不再依赖 `drizzle-kit push`）
- `orders.user_id` 允许为空（游客结算此前必然违反非空约束）
- 卖家看板裸 SQL 列名修复（`_created_at` → `created_at`，此前运行时必报错）
- 退款申请查询 enum 列误用 ILIKE 修复；订单关键词搜索 uuid 列 ILIKE 修复

### Added（真实性补齐）
- Stripe webhook 端点（`/api/payments/stripe-webhook`）：时间戳容忍 + 恒定时间签名比较 + 幂等入账
- PayPal 真实退款（`POST /v2/payments/captures/{id}/refunds`）；移除"伪造退款成功"的占位逻辑
- 统一支付入账 `markOrderPaid`：demo / Stripe / PayPal / 卖家手动标记共用；按渠道流水号幂等；销量改为支付成功时累计
- 运费接入结算：服务端按运费模板重算（重量/件数/满额包邮/特殊地区），买家结算页展示报价
- AI 客服对话会话落库（卖家「咨询管理」可回看）；TrendAgent 报告落库 + 「AI 分析中心 → 历史报告」回看
- 访客统计：`visits` 埋点 + 看板按浏览器会话去重（取代"咨询会话数"伪口径）
- 会员积分：支付成功按 1 美元 1 分累计，退款按金额回滚，`/api/auth/me` 返回
- pg_trgm GIN 索引（商品标题模糊搜索真正走索引）；翻译支持泰文（12 种语言与文档一致）
- 演示数据种子（`SEED_DEMO_DATA=true`）：演示卖家/买家/商品/优惠码 TEST10 自动写入
- 单元测试（Vitest）：订单金额、退款金额判定、运费规则；CI 增加真实端到端冒烟 job（Postgres service + 下单/支付/退款全链路断言）
- `TRUST_PROXY`（反代下真实客户端 IP）、`COOKIE_DOMAIN`、`SELLER_REGISTRATION_CODE`（卖家注册邀请码；未配置则禁止卖家自助注册）、`CORS_ORIGINS` 生效

### Changed
- 安全：CSRF 中间件真正注册（webhook 白名单豁免）；登录/注册 5 次/分、AI 公开端点 10 次/分限流；移除可被 XFF 伪造绕过的内存限流；Google OAuth 增加 state 校验
- 订单状态机：仅允许合法迁移（如 pending_payment → paid/shipped 之外一律拒绝）
- 退款：部分退款必须向渠道传递明确金额（修复"按金额部分退款实际全额退"的账实不符）；累计退款不得超过支付金额；整单退款才回补库存
- 认证 DTO（class-validator）：注册/登录与 AI 端点请求现在会被真实校验（此前 ValidationPipe 因缺少 DTO 类而形同虚设）
- 配置加载：`dotenv` 在进程启动最早阶段加载；JWT 密钥校验延迟到依赖注入阶段（消除 `.env` 读取顺序问题）
- ESLint：启用 react-hooks 规则；修复全部历史 lint 错误（仓库首次 `eslint .` 零错误）

### Removed
- 死代码：orders 内两套重复退款实现、Fulfillment/Notes 无路由方法（约 320 行）、`EMBEDDING_*` 残留配置、重复 axios 拦截器、未使用的 `@nestjs/config` 注入
- 假路径：`drizzle-kit push` 启动脚本、"npx 在线拉取"占位

### Migration Notes
- 1.2.0 起数据库结构由 `drizzle/` 迁移管理：`npm run db:migrate`（或启动时自动执行）。此前用 `db:push` 管理的旧库请先备份；`sold` 销量口径改为"支付时累计"，历史数据不追溯。
- 卖家自助注册默认关闭：维护演示环境请在 `.env` 配置 `SELLER_REGISTRATION_CODE` 或使用 `SEED_DEMO_DATA=true`。

### Verification
- `npm ci`（干净检出）→ `npm run lint`（0 错误）→ `npm run type:check`（双端 0 错误）→ `npm run test`（15/15 通过）→ `npm run build`（服务端 + 前端）
- `docker build` 成功；`docker compose up` 后全链路冒烟通过（注册 → 运费报价 9.00 → 下单 39.00 → 演示支付 → 部分退款，13 项断言全部通过）

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
