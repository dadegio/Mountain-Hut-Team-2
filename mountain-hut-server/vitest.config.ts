import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Fake values for tests only: config.ts requires them and CI has no .env
    env: {
      SESSION_SECRET: 'test-only-secret-not-used-anywhere-else',
      SESSION_SALT: 'test-only-salt-1',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
