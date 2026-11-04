import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  forbidOnly: isCI, // fail CI if someone left a test.only
  retries: isCI ? 1 : 0, // one retry in CI for timing hiccups
  workers: 1, // tests share the same database and seats
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI, // locally, reuse your running dev server
    timeout: 120_000,
  },
})