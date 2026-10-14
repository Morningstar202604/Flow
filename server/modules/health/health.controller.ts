import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  @Get()
  async check(): Promise<{ status: string; db: string; time: string }> {
    try {
      await this.db.execute(sql`SELECT 1`);
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        db: 'down',
        time: new Date().toISOString(),
      });
    }
    return { status: 'ok', db: 'up', time: new Date().toISOString() };
  }
}
