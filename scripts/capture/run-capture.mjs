#!/usr/bin/env node
/**
 * 一键生成演示资产：embedded-postgres + 迁移 + 应用（生产构建）+ 演示数据 + 截图 + 录屏。
 *
 * 用法：npm run capture:all
 * 依赖：本机 Chrome（或 CHROME_PATH）、ffmpeg（录屏时）。
 */
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { rm, mkdir } from 'node:fs/promises';

const PG_PORT = Number(process.env.CAPTURE_PG_PORT ?? 5439);
const APP_PORT = Number(process.env.CAPTURE_PORT ?? 3300);
const repo = process.cwd();

const pg = new EmbeddedPostgres({
  databaseDir: path.join(repo, '.capture-pg'),
  port: PG_PORT,
  user: 'flow',
  password: 'flow_pass',
  persistent: false,
  onLog: () => {},
  onError: (e) => console.error('[pg]', e),
});

const procs = [];
function start(name, args, env) {
  const p = spawn('node', args, { cwd: repo, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  procs.push(p);
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitHealth(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await wait(1000);
  }
  return false;
}
function run(script, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('node', [script], { cwd: repo, env: { ...process.env, ...env }, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
  });
}

try {
  console.log('[capture] starting embedded postgres...');
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('flow');

  const dbUrl = `postgresql://flow:flow_pass@127.0.0.1:${PG_PORT}/flow`;
  await run('scripts/db/migrate.mjs', { DATABASE_URL: dbUrl });

  const env = {
    DATABASE_URL: dbUrl,
    NODE_ENV: 'development',
    PORT: String(APP_PORT),
    APP_URL: `http://127.0.0.1:${APP_PORT}`,
    JWT_SECRET: 'capture-secret-key-at-least-32-characters',
    SELLER_REGISTRATION_CODE: 'smoke-secret',
    SEED_DEMO_DATA: 'true',
  };
  start('server', ['dist-server/server/main.js'], env);
  if (!(await waitHealth(`http://127.0.0.1:${APP_PORT}/api/health`))) {
    throw new Error('server did not become healthy');
  }

  await run('scripts/capture/seed-demo.mjs', {
    DATABASE_URL: dbUrl,
    BASE: `http://127.0.0.1:${APP_PORT}`,
    SELLER_REGISTRATION_CODE: 'smoke-secret',
  });

  await mkdir(path.join(repo, 'docs/screenshots'), { recursive: true });
  await run('scripts/capture/screenshots.mjs', { CAPTURE_BASE: `http://127.0.0.1:${APP_PORT}` });
  await run('scripts/capture/record-demo.mjs', { VIDEO_BASE: `http://127.0.0.1:${APP_PORT}` });

  console.log('[capture] ALL DONE');
} catch (err) {
  console.error('[capture] FAILED', err);
  process.exitCode = 1;
} finally {
  for (const p of procs) {
    try { p.kill('SIGTERM'); } catch {}
  }
  try { await pg.stop(); } catch {}
  await rm(path.join(repo, '.capture-pg'), { recursive: true, force: true }).catch(() => {});
}
