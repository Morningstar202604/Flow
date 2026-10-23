# 治理说明 / Governance

## 维护者 / Maintainers

| 角色 | 职责 |
|---|---|
| Maintainer | 版本发布、架构决策、PR 最终合入 |
| Reviewer | 代码评审、测试与文档把关 |
| Contributor | 提交 Issue / PR、完善文档与示例 |

当前维护者名单以仓库 `CODEOWNERS` 与提交历史为准。

## 决策方式 / Decision Making

- 日常改动：PR + 至少 1 名维护者 review 通过
- 影响架构、数据模型、鉴权、部署的改动：需在 Issue 中先讨论方案，达成一致后实施
- 破坏性变更：必须提供迁移路径，并在 CHANGELOG 的 `Changed` / `Removed` 中注明

## 发布流程 / Release Process

1. 更新 `package.json` 版本号与 `CHANGELOG.md`（Keep a Changelog 格式）
2. 全量验证：`npm run lint` / `npm run type:check` / `npm test` / `npm run build`
3. 打 tag：`git tag vX.Y.Z && git push origin vX.Y.Z`
4. 在 GitHub Releases 中填写变更摘要与升级说明

版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)：破坏性变更升 major，新功能升 minor，修复升 patch。

## 分支策略 / Branches

- `main`：稳定分支，始终可构建、可部署
- 功能分支：`feat/<scope>`、`fix/<scope>`，通过 PR 合入 `main`
- 镜像分支（`gitee-main` / `x33834-main` / `morning-main`）仅用于多平台同步，不作为开发分支

## 行为准则

所有参与者需遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
