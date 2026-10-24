# 安全策略 · Security Policy

**Flow** 重视安全问题。感谢你负责任地披露漏洞，帮助我们保护所有使用者。

## 支持的版本 · Supported Versions

| 版本 Version | 支持状态 Support |
|---|---|
| v1.20.x | 积极维护 |
| < v1.20.0 | 不再支持，建议先升级 |

## 报告漏洞 · Reporting a Vulnerability

**请勿在公开渠道（Issue / PR / 讨论区）披露安全漏洞。**

请通过以下任一私密渠道报告：

1. **GitHub 私密报告**：在 [Security Advisories](https://github.com/X33834/Flow/security/advisories/new) 中提交（推荐）
2. **邮件**：发送至项目维护者邮箱（可在仓库提交记录中获取）

### 报告内容建议

- 影响版本与所在模块（如 `server/modules/orders/`）
- 漏洞类型（IDOR / XSS / SSRF / CSRF / 注入 / 越权等）与复现步骤
- 影响范围与潜在危害评估
- （可选）修复建议或补丁

### 处理承诺

- **48 小时内**确认收到报告
- **5 个工作日内**评估严重性（按 CVSS 分级）
- 严重（Critical / High）漏洞优先修复，修复发布前不在公开渠道讨论
- 修复后会在 [CHANGELOG.md](CHANGELOG.md) 中记录，并致谢报告者（如你愿意署名）

## 已开展的安全工作 · Security Baseline

本项目已完成的加固（详见 [docs/audit-summary.md](docs/audit-summary.md)）：

- **P0 致命 14 项**：IDOR 越权修复、支付伪造防护、Webhook 验签、`JWT_SECRET` 强制、异常脱敏、XSS 净化、金额后端重算、输入校验等
- **P1 重要 16 项**：原子操作防并发、事务化、`decimal.js` 精度、索引与限流、密码强度、通配符转义等
- **P2 加固 4 项**：HttpOnly Cookie 全替代 localStorage + CSRF 头校验、AI 调用计量落库、匿名购物车跨设备迁移码、操作审计日志
- **v1.20.0 多租户收口**：订单 / 退款 / 优惠券 / 商品写操作全部校验卖家归属；跨卖家合单被拒绝；客户 IP 不再无条件采信 `X-Forwarded-For`

## 部署安全建议 · Deployment Security

- 生产环境必须设置强 `JWT_SECRET`（≥32 字符），缺失时应用会拒绝启动
- 使用 HTTPS 部署（Cookie 自动启用 `Secure` 属性）
- 反向代理部署时设置 `TRUST_PROXY`，否则限流与审计只看到代理 IP
- 定期备份数据库（`pg_dump`），并遵循最小权限原则管理服务商密钥
- 关注上游依赖安全公告，及时升级
