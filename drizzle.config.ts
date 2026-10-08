import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://globalecom:globalecom_pass@localhost:5432/globalecom',
  },
  verbose: true,
  strict: false,
});
