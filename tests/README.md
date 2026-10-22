# Test Documentation

This directory contains end-to-end tests for the Baytul Iqra Bookstore application using Playwright.

## Table of Contents

- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Debugging](#debugging)
- [CI/CD Integration](#cicd-integration)

## Test Structure

### Directory Layout

```
tests/
├── e2e/                    # End-to-end test specifications
│   ├── book-purchase.spec.ts       # Complete purchase flow tests
│   ├── search-functionality.spec.ts # Search feature tests
│   └── cart-management.spec.ts     # Cart operation tests
│
├── pages/                  # Page Object Models (POM)
│   ├── base.page.ts               # Base page with common functionality
│   ├── home.page.ts               # Home page interactions
│   ├── book-detail.page.ts        # Book detail page interactions
│   ├── cart.page.ts               # Cart page interactions
│   └── checkout-success.page.ts   # Success page interactions
│
├── fixtures/               # Test fixtures and configuration
│   ├── base-test.ts              # Extended test with page objects
│   └── test-data.ts              # Test data and generators
│
├── helpers/                # Utility helpers
│   ├── api.helper.ts             # API interactions for test setup
│   └── wait.helper.ts            # Wait strategies
│
└── README.md              # This file
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run tests with UI mode (interactive)
npm run test:ui

# Run specific test file
npx playwright test tests/e2e/book-purchase.spec.ts

# Run tests matching pattern
npx playwright test --grep "should add"

# Run in debug mode
npm run test:debug
```

### Advanced Options

```bash
# Run with specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run with specific number of workers
npx playwright test --workers=2

# Run with trace
npx playwright test --trace on

# Generate test report
npm run test:report
```

### Production Testing

```bash
# Test against production environment
npm run test:prod

# Or set base URL manually
PLAYWRIGHT_TEST_BASE_URL=https://yoursite.com npm test
```

## Writing Tests

### Using Page Object Model

Tests use the Page Object Model pattern for maintainable and reusable code:

```typescript
import { test, expect } from '../fixtures/base-test';

test('should add book to cart', async ({ homePage, cartPage }) => {
  // Page objects are automatically available
  await homePage.navigate();
  await homePage.searchForBook('Book Title');
  await homePage.addBookToCart(bookId);
  
  await homePage.goToCart();
  
  const isEmpty = await cartPage.isCartEmpty();
  expect(isEmpty).toBe(false);
});
```

### Test Data Setup

Use API helpers to create test data:

```typescript
import { APIHelper } from '../helpers/api.helper';
import { generateTestEmail } from '../fixtures/test-data';

test.beforeEach(async ({ page }) => {
  const baseURL = 'http://localhost:3000';
  const apiHelper = new APIHelper(page.request, baseURL);
  
  // Find book with stock
  const testBook = await apiHelper.findInStockBook();
  
  // Generate unique test email
  const email = generateTestEmail();
});
```

### Test Isolation

Each test should be independent:

```typescript
// ✅ Good - Independent test
test('should add book to cart', async ({ homePage }) => {
  await homePage.navigate();
  await homePage.addBookToCart(bookId);
  // Test complete, cart will be cleared automatically
});

// ❌ Bad - Depends on previous test
test('cart should have book from previous test', async ({ cartPage }) => {
  // This will fail if run independently
});
```

## Best Practices

### 1. Use Test-ID Locators

Always use `data-testid` attributes for reliable element selection:

```typescript
// ✅ Good
const button = page.getByTestId('checkout-button');

// ❌ Avoid - Fragile
const button = page.locator('.btn-primary.checkout');
```

### 2. One Assertion Per Test Intent

Keep tests focused on a single behavior:

```typescript
// ✅ Good - Tests one thing
test('should display email validation error', async ({ cartPage }) => {
  await cartPage.clickCheckout();
  const errorVisible = await cartPage.isEmailErrorVisible();
  expect(errorVisible).toBe(true);
});

// ❌ Bad - Tests multiple things
test('checkout validation', async ({ cartPage }) => {
  await cartPage.clickCheckout();
  expect(await cartPage.isEmailErrorVisible()).toBe(true);
  expect(await cartPage.isPromoCodeErrorVisible()).toBe(false);
  expect(await cartPage.getTotalPrice()).toBe('$10.00');
});
```

### 3. Descriptive Test Names

Use clear, user-story style test names:

```typescript
// ✅ Good
test('should display success message after completing purchase', async () => {});
test('should show validation error when email is missing', async () => {});

// ❌ Bad
test('test1', async () => {});
test('checkout', async () => {});
```

### 4. Use Proper Wait Strategies

```typescript
// ✅ Good - Wait for specific condition
await page.waitForSelector('[data-testid="cart-icon"]', { state: 'visible' });
await homePage.waitForToast('Added to cart!');

// ❌ Bad - Arbitrary timeout
await page.waitForTimeout(5000);
```

### 5. Leverage Test Hooks

```typescript
test.describe('Cart Tests', () => {
  test.beforeEach(async ({ homePage }) => {
    // Common setup for all tests
    await homePage.navigate();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup after each test
  });
});
```

## Debugging

### Visual Debugging

```bash
# Open Playwright Inspector
npm run test:debug

# Generate new test with Codegen
npm run test:codegen
```

### Trace Viewer

```bash
# Run with trace
npx playwright test --trace on

# View trace
npx playwright show-trace test-results/trace.zip
```

### Screenshots and Videos

Tests automatically capture:
- Screenshots on failure
- Videos on failure (retention mode)
- Traces on first retry

Find them in `test-results/` directory.

### Console Logging

```typescript
test('debug test', async ({ page }) => {
  // Log to console
  console.log('Current URL:', page.url());
  
  // Pause execution
  await page.pause();
  
  // Take screenshot
  await page.screenshot({ path: 'debug.png' });
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Playwright Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      
      - name: Run Playwright tests
        run: NODE_ENV=production npm test
        env:
          PLAYWRIGHT_TEST_BASE_URL: ${{ secrets.TEST_BASE_URL }}
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: test-results/
          retention-days: 30
```

### Environment Variables

Set these in your CI/CD:

```bash
PLAYWRIGHT_TEST_BASE_URL=https://your-staging-url.com
DATABASE_URL=your-test-database-url
STRIPE_SECRET_KEY=your-test-stripe-key
```

## Troubleshooting

### Tests Failing Locally

1. **Ensure dev server is running**: `npm run dev`
2. **Check database has data**: `npm run db:seed`
3. **Clear browser state**: Delete `playwright/.cache/`
4. **Update Playwright**: `npm install @playwright/test@latest`

### Flaky Tests

1. **Add proper waits**: Use `waitForSelector` instead of `waitForTimeout`
2. **Increase timeout**: Set `timeout` in test config
3. **Add retries**: Configure `retries` for specific tests
4. **Check for race conditions**: Ensure proper async/await usage

### Slow Tests

1. **Run in parallel**: Use more `workers` in config
2. **Optimize API calls**: Use `beforeAll` for shared setup
3. **Use API for data setup**: Avoid UI interactions for test data
4. **Profile tests**: Use `--reporter=dot` to identify slow tests

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)

## Questions?

Contact the development team or open an issue in the repository.


## Money-path API tests

`in-shop-buy-api`, `stripe-webhook-api`, `stock-api` and `promo-codes-api` create their own books, promo codes and
orders directly in the database (see `helpers/money-path.helper.ts`) and delete them afterwards. They:

- only run against a **local** `DATABASE_URL` (otherwise they skip),
- use Stripe **test mode** only (sessions are created but never paid; tests that need Stripe skip without an `sk_test_` key),
- sign webhook events with `STRIPE_WEBHOOK_SECRET` from `.env`,
- never mark an order paid for the first time, so the shop's sale-alert and receipt emails cannot fire.

Not covered on purpose: the "stock went negative" oversell alert, because it emails the shop.

## Production-build tests (`npm run test:server`)

`tests/server` needs a production build, so `playwright.config.server.ts` builds the app and runs `next start` on
port 3100 (not part of `npm test`; the first run takes a minute for the build). It covers:

- **Catalog cache** (`catalog-cache.spec.ts`): a book page serves cached data until an admin edit clears it.
  The cache (`src/lib/catalog.ts`) only exists in a production build.
- **Paid checkout** (`paid-checkout.spec.ts`): the receipt page's fallback (`/api/orders/from-session`), the Stripe
  webhook, refunds and restock, with a real paid session. Stripe has no API to pay a Checkout Session, so the
  [Stripe CLI](https://docs.stripe.com/stripe-cli) (`stripe trigger checkout.session.completed`) pays one in test mode,
  with the order id added to its metadata; the tests skip if the CLI isn't installed. Signed webhook events are built
  from the real paid session / charge. The server's emails go to a local stub (`RESEND_BASE_URL`), so the tests can
  assert "exactly one sale alert and one receipt" and nothing is ever really sent.

Safety: `next start` normally reads `.env.production` (the **production** database and live keys), so the config
passes local/test values explicitly and refuses to run unless `DATABASE_URL` is local and `STRIPE_SECRET_KEY` is a
test key. The Stripe CLI is always run with that test key, never the CLI's own (live-capable) login. Each run leaves a
few throwaway products/sessions in Stripe test mode.
