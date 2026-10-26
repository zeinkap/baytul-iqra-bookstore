# Baytul Iqra Bookstore

An online and in-person bookstore for Islamic literature, live at [www.baytuliqra.com](https://www.baytuliqra.com).
Customers can shop online, or scan a QR sticker on a physical book at a venue (café, bazaar, ...) and pay on their phone.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL (Neon) + Prisma · Stripe · Resend · Claude (chat assistant) · Playwright · Vercel

## What it does

- **Storefront:** browse, search and filter the catalog by category; book pages with photo viewer; cart, wishlist, promo codes; Stripe Checkout for shipping or pickup orders.
- **In-shop selling:** every book has a QR sticker (`/b/<isbn>`) and shows the **in-person price**. Scanning opens the book with Apple Pay / Google Pay / Link / card buttons, or lets the customer add several books to a basket (`/basket`) and pay once. Receipts at `/receipt`. See [docs/WALLET_PAY.md](docs/WALLET_PAY.md).
- **Venues:** the same books travel between venues. Sales are credited to a venue from the admin "Where are the books today?" setting, or from a venue sign QR (`/v/<venue>` → `/venue/welcome`).
- **Chat assistant:** floating widget that recommends books, answers price/stock questions and store policy questions.
- **Emails (Resend):** order confirmation, receipt, refund notice, contact form, and a daily summary of the last 24 hours.
- **Admin panel (`/admin`):** see below.

## Admin panel

Password protected. Sign in at `/admin/login`; sessions last 12 hours.

| Page | Purpose |
| --- | --- |
| `/admin/books` | Add, edit, delete books; stock, online and in-person prices, images, ISBN, age range |
| `/admin/orders` | Orders, refunds, restock of refunded orders, receipts |
| `/admin/promo-codes` | Create and manage discount codes |
| `/admin/payment-links` | Payment links for in-person sales |
| `/admin/scans` | QR scan stats by venue and status |
| `/admin/insights` | Sales, profit, payment methods, restock suggestions |
| `/admin/stock-counts` | Shelf counts vs system stock (shrinkage) |
| `/admin/feedback` | "What book do you wish we had?" requests |
| `/admin/profit-margins` | Margin analysis |

**How auth works:** `POST /api/admin/auth` checks `ADMIN_PASSWORD` and sets a signed, httpOnly, `SameSite=Strict` cookie (HMAC-SHA256, 12h expiry, key from `ADMIN_SESSION_SECRET`, falling back to `ADMIN_PASSWORD`). `src/proxy.ts` blocks every `/admin/*` page without a valid session, and admin API routes call `requireAdmin`. Login attempts are rate limited (5 per 15 minutes per IP, in memory per instance).

## Getting started

Requires Node.js 20+ (CI uses 22) and a PostgreSQL database.

```bash
git clone <repository-url>
cd baytul-iqra-bookstore
npm install            # also generates the Prisma client
cp .env.example .env   # then fill in the variables below
npm run db:migrate     # apply migrations to your local database
npm run dev            # http://localhost:3000
```

To get real data locally, run `npm run db:sync-from-prod` (see [Database](#database)). For an empty database with a small fixed catalog (what the tests use), run `npm run db:seed-test`.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | yes | Stripe API key (use `sk_test_...` locally) |
| `STRIPE_WEBHOOK_SECRET` | yes | Verifies `/api/stripe/webhook` events |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | for wallets | Apple Pay / Google Pay buttons on scan and basket pages |
| `NEXT_PUBLIC_BASE_URL` | yes | Public site URL, used in emails, redirects and QR links |
| `ADMIN_PASSWORD` | yes | Admin login password |
| `ADMIN_SESSION_SECRET` | recommended | Signs admin session cookies (`openssl rand -hex 32`) |
| `RESEND_API_KEY` | yes | Sending emails |
| `ANTHROPIC_API_KEY` | for chat | Chat assistant and the description / age-range / price research scripts |
| `CHAT_MODEL` | no | Overrides the chat assistant's model |
| `PRICE_MODEL` | no | Overrides the model used by the price research script |
| `CRON_SECRET` | prod | Lets Vercel Cron call the daily summary endpoint |
| `PROD_DATABASE_URL` | no | Source for `db:sync-from-prod` (or `DATABASE_URL` in `.env.production`) |

See [.env.example](.env.example). Never commit `.env` files.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Dev server (Turbopack), production build, production server |
| `npm run lint` / `typecheck` | ESLint, `tsc --noEmit` |
| `npm run studio` | Prisma Studio |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run migrate:status` | Show migration status |
| `npm run db:reset` | Reset the database (destructive) |
| `npm run db:backup` / `db:restore` | Back up / restore books and categories (JSON in `backups/`) |
| `npm run db:sync-from-prod` | Copy the production catalog to your local database |
| `npm run db:seed-test` | Seed an empty local database for tests |
| `npm run qr:generate` | QR labels for every book (SVG, printable HTML, 2×2 in PDF, CSV) in `qr-labels/` |
| `npm run qr:venue-signs -- <venue> ...` | Printable venue signs |
| `npm test`, `test:headed`, `test:ui`, `test:debug`, `test:report`, `test:server` | Playwright (see [Testing](#testing)) |

Other one-off scripts live in `scripts/` and run with `npx tsx scripts/<name>.ts` (header comments explain usage), e.g. `suggestAgeRanges` / `applyAgeRanges` and `suggestDescriptions` / `applyDescriptions` (Claude writes suggestions to a CSV for you to review; `apply` is a dry run unless you pass `--apply`; run `npm run db:backup` first). For prices, see [Pricing](#pricing).

QR labels: `BASE_URL=https://www.baytuliqra.com npm run qr:generate`. Stickers don't carry a venue; the venue comes from the admin setting or a venue sign.

## Database

PostgreSQL via Prisma (`prisma/schema.prisma`, migrations in `prisma/migrations/`). Models: `Book`, `Category`, `PromoCode`, `Order`, `Scan`, `StockCount`, `Feedback`, `AppSetting`.

- **Orders** are created before payment (`paidAt` is null) and finished when Stripe confirms: `checkout.session.completed` / `payment_intent.succeeded` webhooks, or the receipt page. Finishing marks the order paid, takes stock exactly once (`stockUpdatedAt`) and sends the receipt. Refunds arrive through `charge.refunded`; an admin can then restock the books.
- **Migrations in production:** `npm run build` runs `scripts/migrateOnProduction.mjs`, which applies migrations only for Vercel production builds. Preview builds share the production `DATABASE_URL` and do not migrate, so a PR's migration reaches production after merge. Locally run `npm run db:migrate` after pulling new migrations. To apply manually: `DATABASE_URL=<prod url> npx prisma migrate deploy`.
- **Backups:** `npm run db:backup` writes timestamped JSON files plus `books-backup-latest.json` to `backups/`; `npm run db:restore` is interactive and asks before overwriting. Back up before migrations or bulk edits.
- **Sync production to local:** `npm run db:sync-from-prod` only reads from production. It refuses to run unless your local `DATABASE_URL` is on localhost, applies pending migrations locally, then replaces local books, categories and promo codes in one transaction (this also clears local orders, scans and stock counts). Add `--include-orders` to copy customer orders, `--yes` to skip the confirmation. Needs `psql` and a `pg_dump` at least as new as the production server (`brew install postgresql@17`).

## Pricing

Each book has two prices:

- **Online price** (`price`): the website and Stripe Checkout orders. Online orders add shipping on top.
- **In-person price** (`inShopPrice`, optional, whole dollars): QR scan pages, the in-shop basket, receipts and the in-shop checkout. Empty means in-person uses the online price. It is never above the online price and ignores shipping.

The server picks the price for the channel in `src/lib/pricing.ts` (`unitPrice` / `priceItems(items, channel)`); the browser only sends book ids and quantities. Set both prices in `/admin/books`. Promo codes work the same on either channel (there is no promo code entry on the in-shop scan page yet).

**Price research (suggest-only).** `suggestPrices.ts` uses Claude with web search to find what new copies of each book (same edition and format) sell for, then writes a CSV of suggested online and in-person prices. It never changes the database.

```bash
npx tsx scripts/suggestPrices.ts --limit 5 --in-stock     # try a few books first; every web search costs money
npx tsx scripts/suggestPrices.ts --in-stock               # all books in stock -> price-suggestions-<today>.csv
# review/edit the suggestedOnlinePrice and suggestedInPersonPrice columns (clear a cell to skip it)
npx tsx scripts/applyPrices.ts                            # dry run on the newest price-suggestions-*.csv
npm run db:backup
npx tsx scripts/applyPrices.ts --apply                    # write (add --skip-low to ignore low-confidence rows)
```

- The first column of every row, `runDate`, is the day the script ran. The default file name includes it too.
- Each row has the market price, the competitor prices and links it found (only pages that really appeared in the search results), a confidence level and notes.
- Rules (change with flags): online price keeps at least a 15% margin after cost and shipping (`--min-margin 0.2`); in-person is 10% cheaper than online, rounded **down** to a whole dollar, with its own margin check that ignores shipping (`--in-person-discount 0.15`). Books with no cost price skip the margin check.
- The storefront can show an old online price for up to 5 minutes after `--apply` (catalog cache); checkout always charges the database price.

## Payments and promo codes

- Stripe Checkout for online orders and the in-shop card button; Stripe Express Checkout Element for Apple Pay / Google Pay / Link on scan and basket pages. Prices always come from the database, never the client.
- **One-time Stripe setup:** register `www.baytuliqra.com` under Payment method domains (Apple Pay), and make the webhook endpoint (`/api/stripe/webhook`) receive `checkout.session.completed` (and `async_payment_succeeded`), `payment_intent.succeeded` and `charge.refunded`. Details in [docs/WALLET_PAY.md](docs/WALLET_PAY.md).
- **Promo codes:** percentage or fixed amount, with minimum order, usage limit and validity dates. They discount the product subtotal only (never shipping) and the discount is spread proportionally across items. Validated at `/api/promo-codes/validate`, managed at `/admin/promo-codes`, usage tracked per code.
- **Tap to Pay** (customer taps a card on your phone): see [docs/TAP_TO_PAY.md](docs/TAP_TO_PAY.md).

## Chat assistant

`ChatWidget` talks to `POST /api/chat`, which calls Claude with two tools (`search_books`, `get_book`) over the live catalog. Store policies live in `src/lib/chat/systemPrompt.ts`. Set each book's **Age Range** (e.g. `6-9`, `10-13`, `14+`, `All ages`) in the admin so age-based recommendations work. Order status is intentionally unsupported; the bot points customers to support. Rate limiting is in memory per instance (`src/lib/chat/rateLimit.ts`); use a shared store such as Upstash for a hard limit.

## Daily summary

Vercel Cron calls `GET /api/cron/daily-summary` daily at 02:00 UTC (`vercel.json`) with `Authorization: Bearer $CRON_SECRET`. It emails the last 24 hours: sales, refunds, scans and failures by venue, abandoned in-shop orders, payment methods, restock suggestions and new feedback. Nothing is sent on a quiet day. When signed in as admin you can open it in the browser with `?preview=1` (show without sending) or `?force=1` (send anyway).

## Testing

Playwright end-to-end tests in `tests/` (`e2e/` specs, `pages/` page objects, `fixtures/`, `helpers/`). See [tests/README.md](tests/README.md) for conventions.

```bash
npm test                  # e2e suite against the dev server (starts it for you)
npm run test:ui           # interactive runner
npm run test:server       # production-build tests: catalog cache and paid checkout
npx playwright test tests/e2e/cart-management.spec.ts
```

- Tests change stock, orders and promo codes, so run them against a throwaway local database (`npm run db:seed-test`), never production.
- `test:server` builds the app and runs `next start`; it refuses to run unless `DATABASE_URL` is local and `STRIPE_SECRET_KEY` is a test key, and it needs the [Stripe CLI](https://stripe.com/docs/stripe-cli).
- **CI** ([.github/workflows/playwright.yml](.github/workflows/playwright.yml)) runs on every PR and push to `main`: the e2e suite in 4 shards, each with its own Postgres, plus the production-build tests. Tests needing Stripe skip unless the repo secret `STRIPE_TEST_SECRET_KEY` is set.
- Quick manual browser checks with an AI agent: [docs/EXPECT_BROWSER_TESTING.md](docs/EXPECT_BROWSER_TESTING.md).

## Project structure

```
src/
├── proxy.ts          # Server-side gate for /admin/* pages
├── app/
│   ├── admin/        # Admin pages
│   ├── api/          # Route handlers: books, orders, checkout_sessions, in-shop, stripe/webhook,
│   │                 #   promo-codes, chat, scans, feedback, contact, cron, admin/*
│   ├── b/[code]/     # QR scan page for a book
│   ├── v/, venue/    # Venue sign redirect and welcome page
│   ├── basket/, receipt/, cart/, checkout/, books/, wishlist/, contact/
├── components/       # UI components (ChatWidget, InShopPayButtons, Admin*, ...)
└── lib/              # adminAuth, finalizeOrder, stockManager, pricing, catalog cache, insights,
                      #   dailySummary, sendEmail, chat/, ...
prisma/               # schema.prisma and migrations
scripts/              # Backup/restore, prod sync, QR labels, seeding, AI suggestion scripts
tests/                # Playwright tests
docs/                 # Wallet pay, Tap to Pay, browser testing
```

## Deployment

Hosted on Vercel; pushes to `main` deploy to production and apply pending migrations. Set the environment variables above in the Vercel project. Performance is tracked with Vercel Speed Insights.

## License

Private - all rights reserved.
