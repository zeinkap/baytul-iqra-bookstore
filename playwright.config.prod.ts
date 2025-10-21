import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for production testing
 * 
 * This config is optimized for production environment:
 * - No local server startup
 * - More retries for network stability
 * - Multiple browser testing
 * - Stricter test isolation
 */
export default defineConfig({
  testDir: "./tests/e2e",

  // Maximum time one test can run
  timeout: 90 * 1000,

  // Test execution settings
  fullyParallel: true,
  forbidOnly: true, // Fail if test.only() is committed
  retries: 2, // Retry twice on failure for production
  workers: 6, // More workers for CI environment

  // Reporter to use
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ["json", { outputFile: "test-results/test-results.json" }],
    ["github"], // GitHub Actions reporter
  ],

  // Shared settings for all tests
  use: {
    // Base URL should be set via environment variable
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL || "https://your-production-url.com",

    // Collect trace on first retry
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure
    video: "retain-on-failure",

    // Emulate timezone
    timezoneId: "America/New_York",

    // Emulate locale
    locale: "en-US",

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Action timeout
    actionTimeout: 20 * 1000,

    // Navigation timeout
    navigationTimeout: 45 * 1000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // Uncomment to test on other browsers
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },

    // // Test against mobile viewports
    // {
    //   name: "Mobile Chrome",
    //   use: { ...devices["Pixel 5"] },
    // },

    // {
    //   name: "Mobile Safari",
    //   use: { ...devices["iPhone 12"] },
    // },
  ],
});

