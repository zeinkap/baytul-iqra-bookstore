import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for local development
 * 
 * This config is optimized for local testing with:
 * - Fast execution with workers
 * - Headed mode option for debugging
 * - Retry on failure for flaky tests
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // Maximum time one test can run
  timeout: 60 * 1000,
  
  // Test execution settings
  fullyParallel: true,
  forbidOnly: false, // Allow test.only() in local development
  retries: 0, // No retries - our tests are now stable
  workers: 4, // Run tests in parallel with 4 workers
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/test-results.json' }]
  ],
  
  // Shared settings for all tests
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3000',
    
    // Collect trace only on failure
    trace: 'retain-on-failure',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure only
    video: 'retain-on-failure',
    
    // Emulate timezone
    timezoneId: 'America/New_York',
    
    // Emulate locale
    locale: 'en-US',
    
    // Viewport size
    viewport: { width: 1280, height: 720 },
    
    // Reduced action timeout for faster feedback
    actionTimeout: 10 * 1000,
    
    // Reduced navigation timeout
    navigationTimeout: 15 * 1000,
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    // Uncomment to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    
    // Test against mobile viewports
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],
  
  // Run local dev server before starting tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

