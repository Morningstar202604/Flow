# Flow — AI Agent 说明

| 项 | 内容 |
|---|---|
| 版本 | v1.0.0 / 2026-09-30 |
| 调用协议 | OpenAI 兼容（`POST {LLM_BASE_URL}/v1/chat/completions`） |
| 计量 | 每次调用（成功+失败）均落 `ai_usage_log` |

---

## 通用调用约定

> **模型适配说明（真实模型实测）**：兼容 OpenAI 协议的服务商均可直接使用（DeepSeek / 通义 / 智谱 / 火山方舟 / 云知声 / 商汤等）。
> 网关已处理两类真实差异：① 思考型模型（reasoner / u2 / *-thinking）的 token 预算自动提升至 ≥6000，避免思维链占满预算导致正文被截断；
> ② 响应正文可能出现在 `reasoning_content` / `output_text` / `text` 字段，网关按序容错取值。
> Base URL 支持任意版本段（`/v1`、`/v3`、`/v4`、`/compatible-mode/v1`），会自动拼出正确的 `/chat/completions`。
> **模型配置来源**：界面设置（卖家工作台「AI 分析中心 → 模型设置」）优先级高于 `LLM_*` 环境变量；
> 两者都未配置时，所有端点统一返回 400「请填写模型」（`LLM_NOT_CONFIGURED_MESSAGE`），绝不返回假数据。
> 另：卖家可创建任意数量的自定义 Agent（系统提示词 + `{{input}}` 模板 + 文本/JSON 输出），用量按 `custom:<slug>` 独立计量。



所有 Agent 统一经 `server/modules/ai/ai-gateway.service.ts` 收口：

```http
POST {LLM_BASE_URL}/v1/chat/completions
Authorization: Bearer {LLM_API_KEY}
Content-Type: application/json

{
  "model": "{LLM_MODEL}",          // 默认 deepseek-chat
  "messages": [...],
  "response_format": { "type": "json_object" },   // 仅 Copywriter/Select 等要求结构化输出时
  "temperature": 0.7
}
```

**未配 key 的降级行为（重要）**：
- `LLM_BASE_URL` / `LLM_API_KEY` 缺失时，Gateway 在调用前即返回 `400 { message: "未配置 LLM API Key" }`，**绝不返回硬编码假数据**。
- 前端在 AI 分析中心顶部显示醒目提示条，列出需配置的 3 个环境变量。
- 失败调用仍会写入 `ai_usage_log`（`success=false` + `error_message`），便于运维排查。
- SupportAgent 的检索为关键词召回：命中商品关键词时对 `products` 表做 `ILIKE` 模糊匹配（标题已建 pg_trgm GIN 索引）。

---

## 1. CopywriterAgent — 商品文案生成

| 项 | 内容 |
|---|---|
| 触发时机 | 卖家在"商品管理"页对某商品点击"AI 生成文案" |
| 输入 | 商品原始信息（品名、类目、核心卖点草稿、目标市场语言） |
| 输出 | 结构化 JSON：`{ titleEn, bulletPoints[], longDescription, seoKeywords[] }` |
| 模型 | `deepseek-chat`（通用对话模型） |
| 实现要点 | 强制 `response_format=json_object`，解析后写回商品多语言字段 |
| 未配 key 行为 | 返回 400，前端提示"请先配置 LLM_API_KEY" |

---

## 2. SupportAgent — 智能客服（RAG）

| 项 | 内容 |
|---|---|
| 触发时机 | 买家在任意页面右下角客服浮窗发消息 |
| 输入 | 买家问题文本 + 当前会话上下文（历史 N 轮） |
| 输出 | 自然语言回复文本 |
| 模型 | `deepseek-chat` |
| 三层检索 | ① `products` 表关键词匹配（标题/描述 `ILIKE`，含 pg_trgm 索引）；② 5 条店铺政策 FAQ 常量（退换货/发货/支付/物流/客服时间）；③ 买家最近订单状态摘要 |
| 落库 | 会话与消息写 `inquiry_sessions` / `inquiry_messages`，卖家端"咨询管理"可见 |
| 未配 key 行为 | LLM 调用返回 400；但会话已落库，卖家可见买家在等待人工回复 |

---

## 3. TrendAgent — 趋势分析

| 项 | 内容 |
|---|---|
| 触发时机 | 卖家在"AI 分析中心"点击"生成趋势报告" |
| 输入 | SQL 预聚合的近 30 天销售数据：GMV、订单量、分类占比、Top 10 商品、同比/环比 |
| 输出 | 自然语言趋势分析报告（markdown），含结论与建议 |
| 模型 | `deepseek-reasoner`（推理模型，适合数据分析与归因） |
| 落库 | 报告写 `ai_reports` 表，可在历史报告列表回看 |
| 未配 key 行为 | 返回 400；预聚合数据本身可用，仅 LLM 解读缺失 |

---

## 4. SelectAgent — 选品建议

| 项 | 内容 |
|---|---|
| 触发时机 | 卖家在"AI 分析中心"点击"选品建议" |
| 输入 | 当前类目列表 + 店铺 Top 20 热销商品 + 近 30 天趋势摘要 |
| 输出 | JSON 数组：`[{ category, reason, estimatedDemand, riskLevel }]` |
| 模型 | `deepseek-chat`，强制 `response_format=json_object` |
| 未配 key 行为 | 返回 400 |

---

## 5. TranslationAgent — 多语言翻译

| 项 | 内容 |
|---|---|
| 触发时机 | 卖家编辑商品时点击"AI 翻译"，或批量商品多语言补全 |
| 输入 | 源语言文本（通常英文）+ 目标语言代码 |
| 输出 | 翻译后的文本 |
| 模型 | `deepseek-chat` |
| 支持语言 | 12 种：zh（简中）、en（英）、es（西）、pt（葡）、fr（法）、de（德）、it（意）、ja（日）、ko（韩）、ru（俄）、ar（阿）、th（泰） |
| 已落地前端语言 | 当前买家界面已切换 zh / en / es / pt 四语言；其余 8 语言由本 Agent 按需翻译商品内容 |
| 未配 key 行为 | 返回 400；前端商品内容自动回退英文 |

---

## 6. Copilot — AI 运营副驾

与前 5 个"只生成内容"的 Agent 不同，副驾通过**工具调用**读取真实店铺数据并执行运营操作，写操作强制人工审批。

| 项 | 内容 |
|---|---|
| 入口 | 卖家工作台 →「AI 运营副驾」`/seller/copilot` |
| 调用协议 | 同一 `AiGatewayService`，`agent=copilot`，`response_format=json_object` |
| 输出协议 | `{"tool":"工具名","args":{...},"thought":"..."}` 或 `{"final":"给卖家的答复"}` |
| 单轮步数上限 | 6 步（防死循环）；单轮待审批动作上限 3 个 |
| 落库 | `copilot_conversations` / `copilot_messages` / `copilot_actions`（含 `batch_id`） |
| 多步计划 | 同一轮多个写动作共享 `batch_id`；`POST /api/copilot/batches/:batchId/resolve` 整批按序执行、**失败即停** |
| 店铺巡检 | `GET /api/copilot/insights`：低库存 / 超时退款 / 未支付订单 / 长期未签收（纯 SQL，不调用 LLM） |
| 巡检阈值 | `GET/PUT /api/copilot/insights/thresholds`：4 项阈值存 `ai_settings`，逐字段校验 + 越界拒绝 + 审计 |
| 导购漏斗 | `GET /api/copilot/shopper-funnel?days=30`：打开→推荐→加购→下单 四阶段按会话去重；下单阶段联真实订单（登录按 userId、匿名按订单快照 sessionId） |
| 需求缺口 | `GET /api/copilot/shopper-demand-gaps?days=90`：导购搜索**零结果**的词（次数/去重会话/最近时间）；SelectAgent 生成选品建议时自动注入近 90 天缺口 |
| 缺口建草稿 | `POST /api/copilot/shopper-demand-gaps/draft`：从缺口词生成 `create_draft_product` 待确认动作（仍走审批，批准后为 draft 状态） |
| 商品级漏斗 | `GET /api/copilot/shopper-product-funnel?days=30`：每个商品被推荐/加购/下单的会话数与加购转化率，按推荐量降序 |
| 定时巡检 | `GET/PUT /api/copilot/watch` + `POST /api/copilot/watch/run`：原生定时器（零新依赖），默认关闭；间隔 5-1440 分钟；`ai_settings` 行级租约做跨实例互斥；只对**新增**告警记摘要 |
| 巡检通知 | `notifyKind=webhook` + `notifyUrl`：POST JSON `{text, content:{text}}`，兼容飞书/企微/钉钉/Slack；`notifyOnlyOnNew` 控制无变化不打扰；发送失败只降级提示，不影响巡检 |
| 通知可靠性 | 指数退避重试（3 次，400ms→800ms，上限 4s）；连续失败 3 次熔断 5 分钟；4xx（除 429）视为永久失败不重试；熔断按通道隔离 |
| 邮件通道 | `notifyKind=email` + `notifySmtp{host,port,secure,user,pass,from,to}`；nodemailer 惰性加载；主题模板支持 `{{count}}/{{critical}}/{{newCount}}` |
| 上架体检 | `GET /api/products/audit/active?limit=200`：扫描 active 商品缺失项（只读，不自动改状态） |
| 一键补全 | `POST /api/copilot/products/backfill-copy {ids}`：对体检出的商品批量生成英文标题/卖点/长描述/SEO（只补空缺字段，图片与库存仍需人工） |
| 通知排版 | `copilot-digest-format.ts` 按渠道渲染：webhook=markdown（飞书/钉钉/企微）、email=HTML 表格、日志=plain；HTML 全字段转义 |
| 草稿 AI 补全 | 批准 `create_draft_product` 后自动调 CopywriterAgent 生成英文标题/卖点/长描述/SEO 并写回；模型未配置时诚实降级提示 |
| 上架门禁 | `PATCH /api/products/:id {status:'active'}` 前校验 6 项（中英标题/图片/售价/库存/描述/分类），未通过返回 400 并列出缺失项；`GET /api/products/:id/publish-readiness` 供前端预览 |

### 工具清单（`server/modules/copilot/copilot-tools.ts`）

| 工具 | 类型 | 说明 |
|---|---|---|
| `get_store_overview` | read | GMV / 订单数 / 访客数 / 商品数 / 今日指标 / 待发货 |
| `list_orders` | read | 按状态、关键词查询订单（≤20 条） |
| `list_products` | read | 按关键词、状态查询商品（≤20 条） |
| `list_low_stock` | read | 总库存低于阈值的在售商品 |
| `list_pending_refunds` | read | 待审批退款列表 |
| `update_order_status` | write | 改订单状态（走 `OrdersService.updateStatus` 状态机） |
| `approve_refund` | write | 批准退款（`RefundsService`：渠道退款 + 库存/积分回补） |
| `reject_refund` | write | 拒绝退款（必须填原因） |
| `update_product_status` | write | 商品上下架 / 草稿 |
| `create_coupon` | write | 建券（percent / fixed / free_shipping） |
| `send_inquiry_reply` | write | 以卖家身份回复咨询会话 |

### 安全模型（fail-closed）

1. **写工具在模型循环内永不执行**：只创建 `copilot_actions(status=pending)`，并把"已提交待确认"回填模型；
2. **审批端点** `POST /api/copilot/actions/:id/resolve` 校验 `action.userId === 当前用户`，非本人一律 403；
3. **参数二次校验**：入参在创建动作前与执行前各校验一次；未知参数、类型错误、枚举外取值、越界数字、格式不符全部拒绝；
4. **未注册工具名直接拒绝**：模型幻觉出的工具（如 `execute_sql`）不会触达任何服务；
5. **动作幂等**：非 `pending` 状态的动作不能重复审批；
6. **全部端点为 seller/admin**：买家访问返回 403。

### 降级行为

- 未配置模型：`POST .../messages` 直接返回 400，提示前往「AI 分析中心 → 模型设置」，不写入任何消息；
- 模型输出非法 JSON：降级为纯文本回复（不臆造工具调用）；工具参数不合法：回填错误提示让模型重试；
- 工具执行失败：动作标记 `failed` 并原文回显错误，绝不谎报成功。

### 联调与验证

```bash
npm run mock:providers                 # Stripe / PayPal / LLM 模拟器（含副驾确定性决策）
npm run smoke:copilot                  # 读工具 → 待审批 → 批准执行 → 拒绝无副作用 → 巡检 → 多步计划 → 越权 403
```

> 多步计划是全链路最有"Agent 感"的能力：卖家只说一句"清库存促销"，副驾会先查低库存、再生成清仓券与下架动作，
> 两条动作打包成一个批次，卖家点「批准整批」后按顺序落地；任一步失败即停，后面保持待确认，不会静默跳过。

---

---

## 7. Shopper — 买家端 AI 导购

买家侧 Agent，和卖家副驾共用协议与网关，但**工具集物理隔离**（`server/modules/shopper/`）。

| 项 | 内容 |
|---|---|
| 入口 | 买家商城右下角「AI 导购」浮窗（全站买家页面） |
| 归属 | 登录买家按 userId；匿名按 `x-session-id`（与购物车同一套会话标识） |
| 工具 | `search_products` / `list_categories` / `get_product_detail` / `get_my_cart`（只读）+ `add_to_cart`（写，需确认） |
| 隔离保证 | 买家工具名与卖家工具名零交集（单元测试断言）；卖家工具名在导购侧查不到，直接拒绝 |
| 加购确认 | 与副驾同一机制：先落 `copilot_actions(pending)`，买家点「加入购物车」才调 `CartService.addItem` |
| 诚实约束 | 只推荐 `status=active` 且有货商品；未配置模型时明确提示"AI 导购暂未开启"，不影响浏览与下单 |

> 为什么不用卖家副驾的 11 个工具？买家永远不该看到订单管理、退款审批、发券、改价这些能力；
> 用独立注册表而不是运行时过滤，避免"过滤写错一次就泄露"的风险。

## 外部能力对照表

| Agent | 需要的环境变量 | 缺 key 时行为 |
|---|---|---|
| CopywriterAgent | `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 400 诚实报错 |
| SupportAgent | `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 400 诚实报错 |
| TrendAgent | `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`（reasoner） | 400 诚实报错 |
| SelectAgent | 同上 | 400 诚实报错 |
| TranslationAgent | 同上 | 400 诚实报错，商品回退英文 |
| Copilot | 同上 | 400 诚实报错，不产生任何动作 |

> 所有 Agent **均为真实 LLM HTTP 调用**，经 ECONNREFUSED / 缺 key 实测验证：网关确实发出了标准 OpenAI 兼容请求，路径/方法/Header 组装正确；不存在用硬编码模板冒充 AI 生成的情况。
