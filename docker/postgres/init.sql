-- Postgres 初始化脚本
-- 自动创建 pg_trgm 扩展（商品关键词模糊搜索所需）
-- 该文件挂载到 docker-entrypoint-initdb.d/，仅在首次初始化数据库时执行

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 可在此处预留初始化 schema 的 SQL（可选）
-- 应用启动后由 Drizzle/迁移机制管理表结构
