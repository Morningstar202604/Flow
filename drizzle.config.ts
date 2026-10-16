import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://flow:flow_pass@localhost:5432/flow',
  },
  verbose: true,
  strict: false,
});
