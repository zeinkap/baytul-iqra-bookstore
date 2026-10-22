import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the catalog cache tests (`npm run test:cache`).
 *
 * The catalog cache (src/lib/catalog.ts) only exists in a production build, so these tests build the app and run
 * `next start` on its own port instead of using the dev server. They use the local database from .env.
 */
const port = 3100;

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the environment
}

// `next start` normally prefers .env.production, which holds the PRODUCTION database. These tests create and edit
// books, so the server is given the local database explicitly (real environment variables win over .env files),
// and nothing runs at all unless that database is local.
const databaseUrl = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(databaseUrl)) {
  throw new Error('Catalog cache tests only run against a local DATABASE_URL (set it in .env).');
}

export default defineConfig({
  testDir: './tests/cache',
  timeout: 60 * 1000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${port}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npx next build && npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: databaseUrl,
      // Keep this server away from live Stripe keys and from sending any email
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      RESEND_API_KEY: 'disabled-in-tests',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? '',
    },
    timeout: 10 * 60 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
