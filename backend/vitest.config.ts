import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      PROJECTS_TABLE: 'Projects-test',
      DONATIONS_TABLE: 'Donations-test',
      IDEMPOTENCY_TABLE: 'Idempotency-test',
      AUDIT_TABLE: 'Audit-test',
      STAGE: 'academic',
    },
  },
});
