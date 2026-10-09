# v1.1.0 清理记录：飞书依赖剥离 & 死代码清除

> 日期：2026-10-09

## 背景

v1.0.0 之前版本中包含飞书/Lark SDK 依赖、多处死代码与空壳实现，导致：
- 编译产物含无用依赖包
- README 描述与实际能力不符（如 pgvector 向量检索已失效）
- 误导性 API 函数、表定义占用维护心智

## 删除内容

### 服务端模块

| 路径 | 原因 |
|---|---|
| `server/modules/embedding/` | EmbeddingService 全空壳：`isReady()` 永返 `false`、`searchSimilarProducts` 永返 `[]`，实际从未被调用 |
| `server/modules/hello/` | 占位示例模块，`/health` & `/info` 返回固定字符串 |
| `server/modules/view/` | catch-all 路由返回固定 JSON，属于脚手架残留 |

### 前端文件

| 路径 | 原因 |
|---|---|
| `client/src/pages/ExamplePage/` | 整个文件全部注释掉的死代码 |
| `client/src/api/inquiry.ts` 中 `createInquirySession` / `getInquiryMessages` / `sendInquiryMessage` | 买家侧会话 API，前端从未调用（seller 侧有独立接口） |
| `client/src/api/categories.ts` 中 `createCategory` / `updateCategory` / `deleteCategory` | 分类管理 API，前端无对应页面 |
| `client/src/api/auth.ts` 中 `getGoogleStatus` / `refreshToken` | Google OAuth 状态查询/Token 刷新，前端未对接 |
| `client/src/api/payments.ts` 中 `getPaymentsByOrder` | 订单支付记录查询，前端无对应页面 |

### 数据库表

| 表 | 原因 |
|---|---|
| `productEmbeddings` | 对应 EmbeddingService 已删除，从不读写 |
| `inquiries` | 旧版静态咨询表单，已被 `inquirySessions` + `inquiryMessages` 取代 |

### 类型定义

| 类型 | 原因 |
|---|---|
| `ShopFAQ` (shared/api.interface.ts) | 从未在任何文件引用 |

## 修改内容

| 文件 | 修改 |
|---|---|
| `server/database/database.provider.ts` | 注入 `ConfigService` 取代直接读 `process.env.DATABASE_URL`，避免 env 加载顺序导致的启动崩溃 |
| `server/app.module.ts` | 移除 `EmbeddingModule`、`HelloModule`、`ViewModule` 注册 |
| `server/modules/ai/ai.module.ts` | 移除 `EmbeddingModule` import |
| `server/modules/ai/support.service.ts` | 移除 `EmbeddingService` 依赖注入与向量检索分支 |
| `server/modules/ai/trend.service.ts` | 修复 `generateTrendReport(userId, userId)` 冗余参数 |
| `client/src/index.tsx` | 移除重复 `<Toaster>` |
| `client/src/api/*.ts` | 清理 58 处 `console.info` 生产噪音日志 |
| `docker/postgres/init.sql` | 移除 `CREATE EXTENSION vector` |
| `docker-compose.yml` | 镜像 `pgvector/pgvector:pg16` → `postgres:16-alpine`（pgvector 不再需要） |

## 编译验证

```
tsc -p tsconfig.json            → 0 errors
tsc -p tsconfig.app.json        → 0 errors
vite build                      → ✓ built in 1.73s (3019 modules)
```

## 质量审计方法

本次清理采用"前向追踪法"：
1. 从每个导出函数/方法出发，grep 全项目引用
2. 从每张表定义出发，grep 任何 service/controller 中的查询
3. 从每个模块出发，确认在 app.module.ts 注册且被实际注入
4. 从每个前端 API 定义出发，grep 各页面组件的调用
5. 对 `// TODO/FIXME/HACK/XXX`、`console.log`、`debugger` 全局扫描

确认无遗漏：任何"声明但从未读写/调用/注入"的实体均已清除。
