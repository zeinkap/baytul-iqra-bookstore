import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

/** Unit tests: pure logic only (no server, database or network). Browser, API and Stripe tests stay in Playwright. */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
