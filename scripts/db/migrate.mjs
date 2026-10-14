#!/usr/bin/env node
/**
 * 轻量迁移执行器：按文件名顺序执行 drizzle/*.sql，已执行记录写入 _migrations 表。
 * 生产镜像内不安装 drizzle-kit（devDependency），由本脚本承担运行时迁移。
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[migrate] DATABASE_URL is not set');
  process.exit(1);
}

const migrationsDir = process.argv[2] ?? path.resolve(process.cwd(), 'drizzle');
const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

try {
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const files = existsSync(migrationsDir)
    ? (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()
    : [];

  const applied = new Set((await sql`SELECT id FROM _migrations`).map((row) => row.id));
  let appliedNow = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const content = await readFile(path.join(migrationsDir, file), 'utf8');
    const statements = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    process.stdout.write(`[migrate] applying ${file} ... `);
    await sql.begin(async (tx) => {
      for (const statement of statements) {
        await tx.unsafe(statement);
      }
      await tx`INSERT INTO _migrations (id) VALUES (${file})`;
    });
    appliedNow += 1;
    console.log('ok');
  }

  console.log(
    `[migrate] done (${appliedNow} applied, ${files.length - appliedNow} already up to date)`,
  );
} catch (err) {
  console.error('[migrate] failed:', err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
