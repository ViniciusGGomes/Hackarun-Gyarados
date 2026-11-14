import { defineConfig } from 'vitest/config'

// Test files that use the PostgreSQL test database share it (TRUNCATE in resetTestDb),
// so files run one at a time.
export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
  },
})
