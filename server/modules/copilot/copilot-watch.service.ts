import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { aiSettings } from '../../database/schema';
import { CopilotInsightsService } from './copilot-insights.service';
import { diffNewInsights, formatInsightDigest } from './copilot-insight-digest';
import type { CopilotInsight } from '../../../shared/api.interface';

/** 巡检调度配置（存 ai_settings，键 copilot_watch_settings） */
export interface WatchSettings {
  enabled: boolean;
  /** 巡检间隔（分钟，5-1440） */
  intervalMinutes: number;
}

export const WATCH_SETTINGS_KEY = 'copilot_watch_settings';
export const DEFAULT_WATCH_SETTINGS: WatchSettings = { enabled: false, intervalMinutes: 30 };
/** 上次巡检快照（用于 diff 出新告警） */
const WATCH_SNAPSHOT_KEY = 'copilot_watch_last_snapshot';
/** 跨进程互斥锁（多副本部署时只有一个实例执行巡检） */
const WATCH_LOCK_KEY = 'copilot_watch_lock';

/**
 * 定时巡检：Node 原生定时器（不引入 @nestjs/schedule，零新依赖）。
 * - 默认关闭，卖家在副驾「巡检设置」里开启
 * - 每个周期重新读配置，改完即时生效
 * - 用 ai_settings 行级锁做跨进程互斥，多副本安全
 * - 只记录"新增告警"与摘要日志；通知渠道（邮件/IM）留给后续接入
 */
@Injectable()
export class CopilotWatchService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CopilotWatchService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private currentIntervalMinutes: number | null = null;

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly insightsService: CopilotInsightsService,
  ) {}

  onApplicationBootstrap(): void {
    // 启动后 30 秒做一次调度自检（不立即跑巡检，避免冷启动打满）
    setTimeout(() => void this.reschedule(), 30_000);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async getSettings(): Promise<WatchSettings> {
    const rows = await this.db
      .select({ value: aiSettings.value })
      .from(aiSettings)
      .where(eq(aiSettings.key, WATCH_SETTINGS_KEY))
      .limit(1);
    if (!rows[0]?.value) return { ...DEFAULT_WATCH_SETTINGS };
    try {
      const parsed = JSON.parse(rows[0].value) as Partial<WatchSettings>;
      return {
        enabled: parsed.enabled === true,
        intervalMinutes: clampInterval(parsed.intervalMinutes),
      };
    } catch {
      return { ...DEFAULT_WATCH_SETTINGS };
    }
  }

  async updateSettings(input: Partial<WatchSettings>, actorId: string): Promise<WatchSettings> {
    const current = await this.getSettings();
    const next: WatchSettings = {
      enabled: input.enabled === undefined ? current.enabled : input.enabled === true,
      intervalMinutes: input.intervalMinutes === undefined
        ? current.intervalMinutes
        : clampInterval(input.intervalMinutes),
    };
    await this.db
      .insert(aiSettings)
      .values({ key: WATCH_SETTINGS_KEY, value: JSON.stringify(next), updatedBy: actorId })
      .onConflictDoUpdate({
        target: aiSettings.key,
        set: { value: JSON.stringify(next), updatedBy: actorId, updatedAt: new Date() },
      });
    await this.reschedule();
    return next;
  }

  /** 按当前配置重建定时器（配置变化后调用） */
  async reschedule(): Promise<void> {
    const settings = await this.getSettings();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.currentIntervalMinutes = settings.intervalMinutes;

    if (!settings.enabled) {
      this.logger.log('定时巡检未开启');
      return;
    }

    const intervalMs = settings.intervalMinutes * 60 * 1000;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.timer.unref?.();
    this.logger.log(`定时巡检已开启：每 ${settings.intervalMinutes} 分钟`);
  }

  /** 执行一次巡检（含跨进程互斥与新增告警 diff） */
  async runOnce(force = false): Promise<{ ran: boolean; message: string }> {
    if (this.running) return { ran: false, message: '上一次巡检仍在执行' };
    this.running = true;
    try {
      if (!force && !(await this.getSettings()).enabled) {
        return { ran: false, message: '定时巡检未开启' };
      }

      const locked = await this.acquireLock();
      if (!locked) return { ran: false, message: '其他实例正在巡检' };

      try {
        const { insights } = await this.insightsService.getInsights();
        const previous = await this.readSnapshot();
        const newInsights = diffNewInsights(previous, insights);
        const digest = formatInsightDigest(insights, newInsights);

        await this.writeSnapshot(insights);
        this.logger.log(digest.replace(/\n/g, ' | '));

        return { ran: true, message: digest };
      } finally {
        await this.releaseLock();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`定时巡检失败：${message}`);
      return { ran: false, message: `巡检失败：${message}` };
    } finally {
      this.running = false;
    }
  }

  // ==================== 内部 ====================

  /**
   * 跨进程互斥：用 ai_settings 一行的 updated_at 做租约。
   * 单条 UPDATE ... WHERE updated_at < now() - lease 是原子的，命中即获得锁。
   */
  private async acquireLock(): Promise<boolean> {
    const leaseSeconds = 300;
    const rows = await this.db.execute<{ key: string }>(sql`
      INSERT INTO ${aiSettings} (key, value, updated_at)
      VALUES (${WATCH_LOCK_KEY}, '1', now())
      ON CONFLICT (key) DO UPDATE
        SET updated_at = now()
        WHERE ai_settings.updated_at < now() - (${leaseSeconds} || ' seconds')::interval
      RETURNING key
    `);
    return Array.isArray(rows) && rows.length > 0;
  }

  private async releaseLock(): Promise<void> {
    await this.db.execute(sql`
      UPDATE ${aiSettings} SET updated_at = now() - interval '1 hour'
      WHERE key = ${WATCH_LOCK_KEY}
    `);
  }

  private async readSnapshot(): Promise<CopilotInsight[]> {
    const rows = await this.db
      .select({ value: aiSettings.value })
      .from(aiSettings)
      .where(eq(aiSettings.key, WATCH_SNAPSHOT_KEY))
      .limit(1);
    if (!rows[0]?.value) return [];
    try {
      const parsed = JSON.parse(rows[0].value) as unknown;
      return Array.isArray(parsed) ? (parsed as CopilotInsight[]) : [];
    } catch {
      return [];
    }
  }

  private async writeSnapshot(insights: CopilotInsight[]): Promise<void> {
    const value = JSON.stringify(insights);
    await this.db
      .insert(aiSettings)
      .values({ key: WATCH_SNAPSHOT_KEY, value })
      .onConflictDoUpdate({
        target: aiSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }
}

function clampInterval(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_WATCH_SETTINGS.intervalMinutes;
  return Math.max(5, Math.min(1440, numeric));
}
