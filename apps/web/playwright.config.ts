import { defineConfig, devices } from '@playwright/test'

const apiOrigin = process.env.VITE_API_ORIGIN ?? 'http://127.0.0.1:3001'
const webOrigin = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:4173'
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://wordscodex:wordscodex@localhost:5432/wordscodex'
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/15'
const jwtAccessSecret =
  process.env.JWT_ACCESS_SECRET ?? 'test-secret-at-least-thirty-two-characters'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: webOrigin,
  },
  webServer: [
    {
      command: 'pnpm --filter @wordscodex/api start',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        API_HOST: '127.0.0.1',
        API_PORT: '3001',
        AUTH_DEV_CODE: '123456',
        DATABASE_URL: databaseUrl,
        JWT_ACCESS_SECRET: jwtAccessSecret,
        REDIS_URL: redisUrl,
        WEB_ORIGIN: webOrigin,
      },
    },
    {
      command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4173',
      port: 4173,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_ORIGIN: apiOrigin,
      },
    },
  ],
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
})
