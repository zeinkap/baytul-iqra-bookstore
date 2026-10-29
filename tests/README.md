# Tests

Tests for Baytul Iqra Bookstore: [Vitest](https://vitest.dev) for pure-logic unit tests, and [Playwright](https://playwright.dev) (Chromium only) for everything that needs a browser, the database or Stripe.

There are four kinds of tests:

| Kind | Where | Runs with | What it covers |
| --- | --- | --- | --- |
| Unit tests | `unit/` (`*.test.ts`) | `npm run test:unit` | Pure functions with no server, database or network: price research rules, event fee maths, estimated card fees. Runs in under a second and needs no setup |
| UI tests | `e2e/` | `npm test` | Pages: search, categories, book detail, cart, checkout success, contact, QR scan, basket, receipt, venue welcome |
| Money-path API tests | `e2e/` (`*-api.spec.ts`, `pricing-integrity`) | `npm test` | Orders, stock, promo codes, Stripe webhook, refunds, in-shop buy, online vs in-person pricing. They create their own rows in the database |
| Production-build tests | `server/` | `npm run test:server` | Catalog cache and a real paid checkout (needs a production build and the Stripe CLI) |

## Unit tests (Vitest)

```bash
npm run test:unit          # run once (also runs in CI as its own job)
npm run test:unit:watch    # re-run on save
```

Put a test in `tests/unit/<name>.test.ts` when the code under test is a pure function (import it with the `@/` alias for `src/`). If it needs a browser, the database, signed webhooks or a running server, write it in `tests/e2e/` instead. Config: `vitest.config.mts`.

## Setup

Tests change stock, orders and promo codes, so **run them against a throwaway local database, never production.**

```bash
cp .env.example .env          # set DATABASE_URL to a local database, STRIPE_SECRET_KEY to an sk_test_ key
npm run db:migrate
npm run db:seed-test          # fills an EMPTY local database with a small fixed catalog (refuses non-local databases)
npm test                      # starts `npm run dev` for you if it isn't already running
```

Tests that need something you haven't set up **skip** instead of failing:

| Needs | Skipped when missing |
| --- | --- |
| Local `DATABASE_URL` | Money-path API tests (they create and delete their own rows) |
| `STRIPE_SECRET_KEY` starting with `sk_test_` | Tests that create Stripe Checkout sessions |
| `STRIPE_WEBHOOK_SECRET` | Webhook, refund and stock tests (events are signed with it; any value works if the server uses the same one) |
| `ADMIN_PASSWORD` | Admin-only refund/restock tests |

## Running tests

```bash
npm test                              # all UI + API tests (local config, 4 workers)
npm run test:headed                   # watch the browser
npm run test:ui                       # Playwright's interactive runner
npm run test:debug                    # step through with the Inspector
npm run test:codegen                  # record a new test against localhost:3000
npm run test:report                   # open the last HTML report
npm run test:server                   # production-build tests (see below)

npx playwright test tests/e2e/cart-management.spec.ts   # one file
npx playwright test --grep "should add"                  # by test name
npx playwright test --shard=1/4                          # one quarter of the suite, like CI
```

`npm test` uses `playwright.config.local.ts`. `NODE_ENV=production` (`npm run test:prod`) switches to `playwright.config.prod.ts`, which targets `PLAYWRIGHT_TEST_BASE_URL` instead of starting a server, retries twice and uses 6 workers. Only point it at a deployment whose data you are happy to have tests touch.

## Production-build tests (`npm run test:server`)

`tests/server` needs a production build, so `playwright.config.server.ts` builds the app and runs `next start` on port 3100. It is not part of `npm test`, and the first run takes a minute for the build.

- **Catalog cache** (`catalog-cache.spec.ts`): a book page serves cached data until an admin edit clears it. The cache (`src/lib/catalog.ts`) only exists in a production build.
- **Paid checkout** (`paid-checkout.spec.ts`): the receipt page's fallback (`/api/orders/from-session`), the Stripe webhook, refunds and restock, with a real paid session. Stripe has no API to pay a Checkout Session, so the [Stripe CLI](https://docs.stripe.com/stripe-cli) (`stripe trigger checkout.session.completed`) pays one in test mode, with the order id added to its metadata. The tests skip if the CLI isn't installed. The server's emails go to a local stub, so the tests can assert "exactly one sale alert and one receipt" and nothing is really sent.

Safety: `next start` normally reads `.env.production` (the production database and live keys), so the config passes local/test values explicitly and refuses to run unless `DATABASE_URL` is local and `STRIPE_SECRET_KEY` is a test key. The Stripe CLI is always run with that test key. Each run leaves a few throwaway products and sessions in Stripe test mode.

## Book requests

`e2e/feedback-admin.spec.ts` covers marking requests in progress / fulfilled, filtering and deleting (admin API and page; needs a local database and `ADMIN_PASSWORD`).

## Hand-recorded sales

`e2e/manual-sales.spec.ts` covers the cash/Zelle recording: the admin API (price, venue, stock, undo; needs a local database and `ADMIN_PASSWORD`) and the Record Sale page. The no-card-fee report rule is a unit test (`unit/manual-sales-reports.test.ts`).

## Event fees

`unit/venue-fees.test.ts` covers the per-venue flat fee calculation. `e2e/venue-fees.spec.ts` covers the admin API (needs a local database and `ADMIN_PASSWORD`; it signs its own admin session), the Insights page form, and the daily summary email text.

## Price research rules

`unit/price-research-rules.test.ts` tests the pure rules in `scripts/priceUtils.ts` (margin floors, in-person discount, whole-dollar rounding). It needs no server, database or network. The Claude web search part of `scripts/suggestPrices.ts` is not tested automatically (it would cost money); try it with `--limit 2`.

## Money-path API tests

`in-shop-buy-api`, `stripe-webhook-api`, `stock-api`, `promo-codes-api` and `refunds-api` create their own books, promo codes and orders directly in the database (`helpers/money-path.helper.ts`) and delete them afterwards. They:

- only run against a local `DATABASE_URL`,
- use Stripe **test mode** only (sessions are created but never paid),
- sign webhook events with `STRIPE_WEBHOOK_SECRET`,
- never mark an order paid for the first time, so the shop's sale-alert and receipt emails can't fire.

Not covered on purpose: the "stock went negative" oversell alert, because it emails the shop.

## Layout

```
tests/
├── e2e/        # Spec files (one per feature)
├── server/     # Production-build specs (catalog cache, paid checkout)
├── pages/      # Page objects: base, home, book-detail, cart, checkout-success, contact
├── fixtures/
│   ├── base-test.ts     # `test` extended with the page objects; mocks the stock-update API so UI tests don't change stock
│   └── test-data.ts     # Sample customers/promo codes, generateTestEmail(), date helpers
└── helpers/
    ├── api.helper.ts            # Find books / call the API for setup
    ├── test-workflows.helper.ts # Add to cart, set up a cart via localStorage, ...
    ├── wait.helper.ts           # Wait strategies
    ├── money-path.helper.ts     # Database + Stripe fixtures and signed webhook events
    ├── stripe-cli.helper.ts     # Runs the Stripe CLI for test:server
    └── server-env.ts            # Ports for the production-build server and email stub
```

## Writing tests

Import `test` from the fixtures to get the page objects:

```typescript
import { test, expect } from '../fixtures/base-test';

test('should add book to cart', async ({ homePage, cartPage }) => {
  await homePage.navigate();
  await homePage.searchForBook('Book Title');
  await homePage.addBookToCart(bookId);
  await homePage.goToCart();

  expect(await cartPage.isCartEmpty()).toBe(false);
});
```

Conventions:

- **Page objects** hold selectors and interactions; specs hold assertions.
- **`data-testid` locators** (`page.getByTestId('checkout-button')`), not CSS classes.
- **One behavior per test**, with a descriptive name ("should show validation error when email is missing").
- **Independent tests:** each test sets up its own data (via `APIHelper`, `setupCartViaLocalStorage` or the money-path fixtures) and must pass on its own and in parallel.
- **Wait for conditions, not time:** `expect(...).toBeVisible()` or `waitForToast(...)`, never `waitForTimeout`.
- **Never touch real money or real email:** use Stripe test mode, and keep the fixtures' stock-update mock in UI tests.

## Debugging

- Failures keep a screenshot, video and trace in `test-results/`. View a trace with `npx playwright show-trace <trace.zip>`; `npm run test:report` opens the HTML report.
- `npm run test:debug` opens the Inspector; `await page.pause()` stops at a line.
- Flaky? Look for a missing wait or a test that depends on another's data before adding retries (CI already retries twice).

## CI

[`.github/workflows/playwright.yml`](../.github/workflows/playwright.yml) runs on every pull request and push to `main`:

- **e2e:** `tests/e2e` split into 4 shards on separate machines, each with its own Postgres 17 service database, then the shard reports are merged into one HTML report artifact.
- **Production-build tests:** `npm run test:server` on its own job, which needs the repo secret `STRIPE_TEST_SECRET_KEY` (an `sk_test_` key) and installs the Stripe CLI. Without the secret, Stripe-dependent tests skip.
- Emails are never sent (`RESEND_API_KEY` is a dummy). Failure traces and videos are uploaded as artifacts.

To change the number of machines, edit the shard list and the `4` in `--shard=…/4`.

See also [docs/EXPECT_BROWSER_TESTING.md](../docs/EXPECT_BROWSER_TESTING.md) for quick manual browser checks with an AI agent.
