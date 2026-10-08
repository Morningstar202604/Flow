import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { eq, and, desc, count, gte, lt } from 'drizzle-orm';
import { auditLogs } from '@server/database/schema';
import type { AuditLog, AuditLogListResponse, AuditLogQuery } from '@shared/api.interface';

export interface AuditLogParams {
  action: string;
  entity?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  userId?: string;
  role?: string;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  private serialize(val: Record<string, unknown> | undefined): string | undefined {
    return val ? JSON.stringify(val) : undefined;
  }

  private deserialize(val: string | null | undefined): Record<string, unknown> | undefined {
    if (!val) return undefined;
    try { return JSON.parse(val); } catch { return undefined; }
  }

  private mapRow(row: typeof auditLogs.$inferSelect): AuditLog {
    return {
      id: row.id,
      userId: row.userId ?? undefined,
      role: row.role ?? undefined,
      action: row.action,
      entity: row.entity ?? undefined,
      entityId: row.entityId ?? undefined,
      before: this.deserialize(row.before),
      after: this.deserialize(row.after),
      ip: row.ipAddress ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: this.serialize(params.before),
        after: this.serialize(params.after),
        userId: params.userId,
        ipAddress: params.ip ?? undefined,
      });
    } catch (error) {
      this.logger.error(
        'Failed to write audit log',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async getAuditLogs(params: AuditLogQuery & { userId?: string }): Promise<AuditLogListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;

    const conditions = [];
    if (params.action) {
      conditions.push(eq(auditLogs.action, params.action));
    }
    if (params.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(params.startDate)));
    }
    if (params.endDate) {
      conditions.push(lt(auditLogs.createdAt, new Date(params.endDate)));
    }
    if (params.userId) {
      conditions.push(eq(auditLogs.userId, params.userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      this.db.select({ count: count() }).from(auditLogs).where(whereClause),
      this.db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(safePageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items = rows.map((row: typeof auditLogs.$inferSelect) => this.mapRow(row));

    return { items, total, page: safePage, pageSize: safePageSize };
  }
}
