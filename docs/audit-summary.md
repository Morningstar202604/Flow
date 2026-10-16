# Flow — 历史检查与修复摘要

| 项 | 内容 |
|---|---|
| 应用 | Flow 出口电商平台 |
| 汇总日期 | 2026-09-30 |
| 覆盖版本 | v0.1.0 → v1.0.0 |

本文件浓缩本仓库从 MVP 到 v1.0.0 收官期间的关键检查报告要点，便于新成员快速了解"做过什么检查、修过什么坑"。详细 diff 见对应版本的 [CHANGELOG.md](../CHANGELOG.md)。

---

## 一、检查与修复时间线

| 日期 | 版本 | 轮次 | 范围 | 结论 |
|---|---|---|---|---|
| 2026-09-25 | v0.2.0 | 逐模块深度检查 | 买家 6 模块 + 卖家 5 模块 + 5 Agent | 修 3 个 bug（咨询分页结构、语言切换、AI 未配置提示）；确认 5 Agent 代码真实非 mock |
| 2026-09-27 | v0.3.0 | 查漏补缺 | 12 项缺口（账号/支付/评价/收藏/优惠券/CSV/小语种/pgvector/物流） | 全部补齐，回归 10/10 通过 |
| 2026-09-30 | v0.4.0 | 安全体检 | P0 致命 14 + P1 重要 16 = 30 项 | 全部修复并验证，P0 安全专项 8/8 通过 |
| 2026-09-30 | v0.5.0 | P2 加固 | 4 项（Cookie 化 / AI 计量 / 购物车同步 / 审计） | 全部完成，回归 10/10 + 安全专项 5/5 |
| 2026-09-30 | v1.0.0 | 收官全量审查 | client/ server/ shared/ scripts/ 全量源码 | 修 7 项（3 处崩溃 + 上下架 404 + env 名对齐 + as any 清理），25 项回归全通过 |

---

## 二、关键经验沉淀（后续迭代可参考）

### 1. 真实性优先，缺 key 诚实报错
- 5 个 AI Agent 全部走真实 OpenAI 兼容 HTTP 调用；缺 `LLM_API_KEY` 时返回 400 而非硬编码假数据。
- 支付、物流同理：未配 Stripe/PayPal/17TRACK key 时进入"演示模式"，UI 明确标注，不假装接通。

### 2. 安全从 P0 到 P2 的演进路径
- **P0**：堵越权（IDOR）、堵支付伪造、webhook 验签、JWT_SECRET 强制、异常脱敏、XSS 净化。
- **P1**：业务逻辑加固（原子操作防并发、事务化、decimal.js 精度、索引与限流、密码强度）。
- **P2**：架构级收紧（HttpOnly Cookie 全替代 localStorage、CSRF 头校验、AI 计量落库、操作审计）。

### 3. 易踩坑点（已在本仓库修复，勿回退）
- `req.userContext.userId` 不存在，应统一用 `req.user?.id`。
- 前端 `updateProductStatus` 不要单独开端点，复用 `updateProduct(id, { status })`。
- `.env.example` 变量名必须与代码 `process.env.*` 完全一致（曾出现 PORT vs SERVER_PORT 不一致）。
- 后端 Controller 中避免 `as any` 绕过类型检查。
- JWT 中间件 `forRoutes` 不支持通配，需逐条列出受保护路径。

---

## 三、剩余非阻塞建议（未修，后续迭代）

| # | 建议 | 说明 |
|---|---|---|
| 1 | `auditService.log()` promise 未 `.catch` | 外层 try/catch 已兜同步异常，风险低 |
| 2 | CSRF 路由列表个别路径名不精确 | 通配符已覆盖写路径，安全无虞 |
| 3 | `schema.ts` custom type `fromDriver` 未处理 null | 文件标注 auto-generated，service 层已空值判断 |
| 4 | hello 模块 / ExamplePage / use-example 模板残留 | 死代码不影响运行，可后续清理 |
| 5 | `rateLimitMap` 无限增长、AI 调用缺超时、`getClientIp` 重复 | 非阻塞，后续迭代 |

---

## 四、收官结论

v1.0.0 已达到"**交易闭环真实可用 + AI 链路就绪待通电 + 安全基线达标 + 可一键 Docker 部署**"状态。
所有致命级与重要级问题已修复并回归通过；剩余建议级项均为非阻塞优化，不构成发布阻断。
