import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.spec.ts', 'shared/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['server/**/*.ts'],
      exclude: [
        'server/**/*.spec.ts',
        'server/database/schema.ts',
        'server/main.ts',
        'server/**/*.module.ts',
        'server/**/*.controller.ts',
      ],
    },
  },
});
