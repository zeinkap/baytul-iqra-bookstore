import { defineConfig, devices } from '@playwright/test';
import { SERVER_PORT, EMAIL_STUB_PORT } from './tests/helpers/server-env';

/**
 * Playwright configuration for the tests that need a production build (`npm run test:server`):
 *  - the catalog cache (src/lib/catalog.ts only exists in a production build),
 *  - the paid-checkout path (Stripe CLI pays a test session; the server's emails are captured by a local stub).
 *
 * It builds the app and runs `next start` on its own port instead of using the dev server.
 */

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the environment
}

// `next start` normally prefers .env.production, which holds the PRODUCTION database and live keys. These tests
// create and edit data, so the server is given local/test values explicitly (real environment variables win over
// .env files), and nothing runs at all unless the database is local and Stripe is in test mode.
const databaseUrl = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(databaseUrl)) {
  throw new Error('These tests only run against a local DATABASE_URL (set it in .env).');
}
if (!(process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_')) {
  throw new Error('These tests only run with a Stripe test-mode STRIPE_SECRET_KEY (set it in .env).');
}

export default defineConfig({
  testDir: './tests/server',
  timeout: 120 * 1000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${SERVER_PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npx next build && npx next start -p ${SERVER_PORT}`,
    url: `http://localhost:${SERVER_PORT}`,
    reuseExistingServer: false,
    timeout: 10 * 60 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      DATABASE_URL: databaseUrl,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? '',
      // Emails go to a stub server run by the tests, never to Resend
      RESEND_API_KEY: 're_dummy_for_tests',
      RESEND_BASE_URL: `http://localhost:${EMAIL_STUB_PORT}`,
    },
  },
});
