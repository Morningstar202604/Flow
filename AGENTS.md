# Flow 出口电商平台

## 项目概览

AI Agent 驱动的出口电商平台，包含买家端 B2C 商城和卖家端 AI 工作台，共享同一套数据库。

## 技术架构

- 前端：React 19 + TypeScript + Tailwind CSS + shadcn/ui
- 后端：NestJS 12（Express 5）+ TypeScript strict + Drizzle ORM
- 数据库：PostgreSQL
- AI：统一 AI Gateway（OpenAI 兼容协议）

## 设计规范

### 色彩系统

**买家端（清新商业风）**
- 主色：`#2563eb` (blue-600)
- 辅助色：`#0ea5e9` (sky-500)
- 强调色：`#f97316` (orange-500) - 促销/折扣
- 成功：`#10b981` (emerald-500)
- 背景：`#f8fafc` (slate-50)
- 卡片：`#ffffff`

**卖家端（专业管理风）**
- 主色：`#1e40af` (blue-800)
- 辅助色：`#6366f1` (indigo-500)
- 强调色：`#8b5cf6` (violet-500) - AI 功能
- 背景：`#f1f5f9` (slate-100)
- 侧边栏：`#0f172a` (slate-900)

### 排版

- 字体：system-ui, -apple-system, sans-serif
- 标题：`text-2xl font-bold` / `text-xl font-semibold` / `text-lg font-semibold`
- 正文：`text-base` (16px)
- 辅助文字：`text-sm text-muted-foreground`
- 行高：标题 1.2，正文 1.5

### 间距

- 页面内边距：`p-6` (24px)
- 卡片内边距：`p-4` (16px)
- 元素间距：`gap-4` (16px)
- 区块间距：`space-y-6` (24px)

### 组件规范

- 圆角：`rounded-lg` (8px) 默认，`rounded-xl` (12px) 卡片
- 阴影：`shadow-sm` 默认，`shadow-md` hover
- 按钮：shadcn Button，variant 按语义选择
- 卡片：shadcn Card，统一风格

## 模块划分

### 买家端（/）
- 首页 `/` - Banner、分类、**运营楼层（精选集合）**、热销、新品、最近浏览
- 商品列表 `/products` - 筛选、排序、分页、搜索
- 商品详情 `/products/:id` - 多图、规格、加购
- 购物车 `/cart` - 列表、增减、跨设备迁移码、结算
- 结算 `/checkout` - 收货信息、运费报价、优惠券、支付
- 订单 `/orders` - 列表、详情、物流、退款申请
- 集合详情 `/collections/:slug` - 集合内全部商品（买家公开）
- CMS 页面 `/page/:slug` - 自定义页面（About / FAQ 等）
- AI 导购 - 买家侧浮窗 Agent：搜索/详情/购物车/加购（加购需确认）

### 卖家端（/seller）
- SEO/OpenAPI/CLI：`/sitemap.xml`、`/robots.txt`、`/llms.txt`、`/api/openapi.json`、`npm run cli --`
- **AI 运营副驾** `/seller/copilot` - 工具调用 Agent：读店铺数据 + 写操作人工审批
- 数据看板 `/seller/dashboard` - GMV、订单、访客、趋势图
- 商品管理 `/seller/products` - CRUD、上下架、变体、CSV 批量导入、AI 文案
- 订单管理 `/seller/orders` - 列表、状态流转、发货、物流
- 退款管理 `/seller/refunds` - 审批、拒绝、库存回补
- 咨询管理 `/seller/inquiries` - 会话、AI/人工回复
- AI 分析中心 `/seller/ai-center` - **模型设置**、用量统计、历史报告、**我的 Agent（自定义）**
- 优惠券 / 运费模板 / 集合 / CMS 页面 / 审计日志

## 数据库表（共 39 张，以 `server/database/schema.ts` 为准；咨询会话已加 seller_id 归属）

- 用户与地址：`users` `addresses`
- 商品：`categories` `products` `productVariants` `stockMovements`
- 交易：`orders` `orderItems` `orderFulfillments` `fulfillmentItems` `payments` `refunds` `orderNotes`
- 营销：`coupons` `couponUsage` `collections` `collectionProducts` `shippingTemplates` `reviews` `reviewHelpfulVotes` `favorites`
- 购物车：`cartItems` `cartRecoveryCodes`
- 内容与咨询：`cmsPages` `redirects` `inquirySessions` `inquiryMessages`
- AI 与运营：`aiSettings` `aiAgents` `aiReports` `aiUsageLog` `pointTransactions` `visits` `auditLogs`
- AI 运营副驾 / 导购：`copilotConversations` `copilotMessages` `copilotActions`（`channel` 区分 seller / shopper）`shopperEvents`

## AI Agent

统一通过 `ai-gateway.service.ts` 调用 LLM（OpenAI 兼容协议）。

**配置优先级**：界面设置（`ai_settings` 表，卖家在「AI 分析中心 → 模型设置」填写）> 环境变量 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`。
**未配置时**：所有 AI 端点返回统一的"请填写模型"提示，绝不返回假数据；AI 以外的功能一律正常运行。

内置 5 个 Agent（代码定义、只读）：Copywriter、Support、Trend、Select、Translation。
另有**自定义 Agent**（`ai_agents` 表，数量不限）：系统提示词 + `{{input}}` 模板 + 文本/JSON 输出 + temperature/maxTokens，用量按 `custom:<slug>` 独立计量。

**模型适配要点**：兼容任意 OpenAI 协议端点（Base URL 支持 `/v1`、`/v3`、`/v4`、`/compatible-mode/v1`，自动拼 `/chat/completions`）；
思考型模型（reasoner / u2 / *-thinking）的 token 预算自动提升至 ≥6000（否则思维链占满预算导致正文被截断）；
响应正文可能出现在 `content` / `reasoning_content` / `output_text` / `text`，网关按序容错取值。

### AI 运营副驾（`server/modules/copilot/`）

工具调用 Agent + 人工审批门禁，模型仍走同一 `AiGatewayService`（用量记入 `agent=copilot`）。

- `copilot-tools.ts`：12 个工具的唯一注册表（5 只读 + 7 写）；每个参数声明类型/枚举/范围/正则，`validateToolArgs` 拒绝未知参数
- `copilot-protocol.ts`：模型输出协议解析（`{"tool":...}` / `{"final":...}`）、工具目录生成、历史折叠
- `copilot-tool.service.ts`：读工具查询；写工具**全部委托** OrdersService / RefundsService / ProductsService / CouponsService / InquiryService，不重复实现业务规则
- `copilot.service.ts`：ReAct 循环（上限 6 步）；写工具在循环内只落 `copilot_actions(pending)`，**审批端点**才执行，且校验动作所有者
- `copilot-insights.service.ts`：店铺巡检（低库存 / 超时退款 / 未支付订单 / 长期未签收），纯 SQL 聚合、不调 LLM
- 多步计划：同轮写动作共享 `batchId`，`POST /api/copilot/batches/:batchId/resolve` 整批按序执行、失败即停
- 巡检阈值：`ai_settings` 键 `copilot_insight_thresholds`，GET/PUT `/api/copilot/insights/thresholds`
- 导购漏斗：`shopper_events` 打点 + `GET /api/copilot/shopper-funnel`（下单阶段联真实订单）
- 需求缺口：零结果搜索记 `search_miss`；`GET /api/copilot/shopper-demand-gaps`；SelectAgent 自动注入近 90 天缺口
- 缺口建草稿：`POST /api/copilot/shopper-demand-gaps/draft` → `create_draft_product` 待确认动作（12 个工具）
- 商品级漏斗：`GET /api/copilot/shopper-product-funnel`（推荐/加购/下单会话 + 转化率）
- 定时巡检：`CopilotWatchService` 原生定时器 + `ai_settings` 租约互斥；`GET/PUT /api/copilot/watch`、`POST /api/copilot/watch/run`
- 巡检通知：`CopilotNotifyService` webhook（飞书/企微/钉钉/Slack 文本格式），失败降级不影响巡检
- 通知可靠性：指数退避 3 次 + 连续失败 3 次熔断 5 分钟（`copilot-notify-retry.ts`）
- 通知通道：`NotifyTransport` 支持 webhook / email（nodemailer）；熔断按通道隔离；邮件主题模板 `{{count}}/{{critical}}/{{newCount}}`
- 上架体检：`GET /api/products/audit/active` 扫描历史在售商品缺失项（只读）
- 一键补全：`POST /api/copilot/products/backfill-copy` 只补空缺文案字段
- 通知排版：`copilot-digest-format.ts`（webhook=markdown / email=HTML / 日志=plain，HTML 转义）
- 通知预览：`GET /api/copilot/watch/preview?format=...`（真实告警数据，不发请求）
- 文案质量抽检：`copy-quality.ts` 6 项启发式 + `copy_source`（manual/ai/reviewed）复核队列
- 上架门禁：`product-publish-check.ts` 6 项校验；PATCH status=active 未通过返回 400
- 草稿 AI 补全：批准 `create_draft_product` 后自动生成英文文案（失败不阻断创建）
- 安全约束：`@RolesGuard(['seller','admin'])` 覆盖全部端点；未注册工具名直接拒绝；参数在执行前二次校验

## 验证入口

- `npm run lint` / `npm run type:check` / `npm test`（166 例单测）/ `npm run build`
- `npm run smoke:all`（embedded-postgres 一键跑完以下 5 套，无需 Docker）
- `npm run smoke:workflows`（16 步全业务工作流）/ `npm run smoke:degraded`（无 Key 降级）/ `npm run smoke`（19 步交易闭环）
- `npm run smoke:copilot`（副驾：读工具 → 待审批 → 批准执行 → 拒绝无副作用 → 巡检 → 多步计划 → 越权 403）
- `npm run smoke:shopper`（导购：工具隔离 → 搜索/详情 → 加购确认 → 会话隔离）
- `npm run mock:providers` + `npm run smoke:providers`（渠道模拟器：AI 五 Agent + Stripe/PayPal 全链路）
