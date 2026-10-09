import { Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE_DATABASE = Symbol('DRIZZLE_DATABASE');

export type Database = PostgresJsDatabase<typeof schema>;

let cachedClient: ReturnType<typeof postgres> | null = null;
let cachedDb: Database | null = null;

export const databaseProvider = {
  provide: DRIZZLE_DATABASE,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Database => {
    if (cachedDb) return cachedDb;

    const connectionString = config.get<string>('DATABASE_URL') ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    cachedClient = postgres(connectionString, { max: 10 });
    cachedDb = drizzle(cachedClient, { schema });

    Logger.log('PostgreSQL connection established (Drizzle + postgres-js)', 'Database');
    return cachedDb;
  },
};

export async function closeDatabase(): Promise<void> {
  if (cachedClient) {
    await cachedClient.end({ timeout: 5 });
    cachedClient = null;
    cachedDb = null;
  }
}
