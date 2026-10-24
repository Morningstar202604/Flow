# 贡献指南 · Contributing Guide

感谢你愿意为 **Flow** 贡献代码、文档或想法！任何形式的帮助都让这个项目变得更好。

Thanks for your interest in contributing to **Flow**! Every kind of help makes this project better.

---

## 目录 / Contents

- [行为准则 / Code of Conduct](#行为准则)
- [如何开始 / Getting Started](#如何开始)
- [开发环境 / Development Environment](#开发环境)
- [代码规范 / Code Style](#代码规范)
- [提交信息格式 / Commit Message Format](#提交信息格式)
- [PR 流程 / Pull Request Process](#pr-流程)
- [文档贡献 / Documentation Contributions](#文档贡献)

---

## 行为准则

所有参与者请遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 如何开始

1. **Fork** 本仓库到你的账号
2. **Clone** 到本地：`git clone https://github.com/<你的账号>/GlobalEcom.git`
3. 创建功能分支：`git checkout -b feat/your-feature`
4. 开发并本地验证（见下文"开发环境"）
5. 提交并推送，然后创建 **Pull Request**（目标分支 `main`）

## 开发环境

```bash
# 前置要求：Node.js ≥ 22、Docker ≥ 24.x、PostgreSQL 16（或直接使用 docker-compose 中的 postgres）

npm install
cp .env.example .env        # 至少设置 JWT_SECRET
npm run dev                 # 前端 Vite + 后端 NestJS watch 同时启动

# 验证
npm run lint                # ESLint
npm run type:check          # 前后端 TypeScript 类型检查
```

> 未配置 `LLM_API_KEY` 等密钥时，AI 功能会诚实返回 400 且不阻断启动，可正常开发非 AI 模块。

## 代码规范

- **语言**：TypeScript 严格模式；禁止 `as any` 绕过类型检查（后端 Controller 尤其注意）。
- **前端**：React 19 + Tailwind CSS + shadcn/ui 组件体系；页面放在 `client/src/pages/`。
- **后端**：NestJS 模块化结构；业务逻辑在 `server/modules/<module>/`。
- **金额**：一律使用 `decimal.js` 精确运算，禁止 `Number` 浮点计算。
- **数据库**：表结构在 `server/database/schema.ts`（Drizzle ORM），新增字段同步更新文档。
- **安全**：写接口保持 CSRF 头校验；订单/支付类接口必须做归属校验（防 IDOR）。
- **AI Agent**：一律经 `server/modules/ai/ai-gateway.service.ts` 收口，**禁止硬编码假数据冒充 AI 结果**。

## 提交信息格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
<type>(<scope>): <subject>

feat(products): 增加 CSV 导出功能
fix(auth): 修复刷新令牌过期处理
docs(readme): 更新快速开始
```

- `type`：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `chore`
- 提交前请运行 `npm run lint` 与 `npm run type:check`，确保通过。

## PR 流程

1. PR 标题遵循上述提交信息格式。
2. 描述中说明改动内容、动机与验证方式。
3. 若涉及 UI 改动，建议附带截图。
4. 若涉及数据库变更，请在描述中说明需要同步的 schema 迁移。
5. 至少 1 名维护者 review 通过后合并；CI（lint + type check）必须通过。

## 文档贡献

- 文档位于 `docs/` 与根目录 `*.md`，欢迎修正错别字、补充示例、完善 FAQ。
- 新增功能时请同步更新 [README.md](README.md) 功能清单与 [CHANGELOG.md](CHANGELOG.md)。
- 文档语言：中英双语，中文为主，关键术语保留英文。

---

再次感谢你的贡献！有任何问题欢迎在 [Issues](https://github.com/X33834/GlobalEcom/issues) 中提出。
