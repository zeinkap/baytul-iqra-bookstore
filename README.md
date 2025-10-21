# Baytul Iqra Bookstore

An online bookstore for Islamic literature built with Next.js, Prisma, and Stripe.

## Features

Baytul Iqra Bookstore is an online Islamic bookstore offering:
- **84+ Books** across multiple Islamic categories
- **Smart categorization** - Hadith & Sunnah, Quran & Tafsir, Children's Books, Biography & Seerah, and more
- **Author management** - Proper attribution for Islamic scholars and contemporary authors
- **Shopping cart & checkout** - Full e-commerce functionality with Stripe payment integration
- **Order Management** - Orders are created via the `/api/orders` endpoint and stored in the `Order` table (PostgreSQL, Prisma). Supports both shipping and pickup fulfillment types
- **Promo code support** - Flexible discount system with validation rules
- **Admin panel** - Complete inventory, order, and promo code management
- **Responsive design** - Works on desktop and mobile devices

## 🛒 Order Management

- Orders are created through the `/api/orders` API endpoint.
- The `Order` table (managed by Prisma/PostgreSQL) stores all order details, including:
  - Cart items (JSON)
  - Total price
  - Discount amount and final total
  - Applied promo codes
  - Fulfillment type (shipping or pickup)
  - Pickup location or shipping address
  - Customer email
- Supports both shipping and pickup workflows.

## 🎫 Promo Code System

A comprehensive discount system that allows customers to apply promo codes during checkout.

### Features
- **Multiple discount types**: Percentage-based or fixed dollar amounts
- **Validation rules**: Minimum order amounts, usage limits, validity periods
- **Real-time validation**: Instant feedback when applying codes
- **Admin management**: Full CRUD operations for promo codes
- **Usage tracking**: Monitor how many times each code has been used

### Admin Interface
- **Access**: Navigate to `/admin/promo-codes` to manage all promo codes
- **Create codes**: Set discount type, value, minimum order amount, and usage limits
- **Edit codes**: Modify existing codes or deactivate them
- **Monitor usage**: Track how many times each code has been used
- **Bulk management**: View all codes in a sortable table format

### Sample Promo Codes
The system comes with three sample promo codes for testing:
- **WELCOME10**: 10% off orders over $25
- **SAVE5**: $5 off orders over $50
- **RAMADAN20**: 20% off orders over $30

### How It Works
1. Customers enter promo codes in the cart page
2. System validates the code against rules (validity, minimum order, usage limits)
3. Discount is applied to product subtotal only (shipping costs are not discounted)
4. Final discounted total is processed through Stripe checkout
5. Promo code usage is tracked in the database

### Discount Rules
- **Product-only discounts**: Promo codes apply to product subtotal only
- **Shipping excluded**: Shipping and handling fees are not eligible for discounts
- **Minimum order validation**: Based on product total before shipping
- **Proportional distribution**: Discounts are distributed proportionally across all products

## 🔐 Admin Authentication

The admin panel is password-protected to secure access to book management, orders, promo codes, and other administrative features.

### Setup

1. **Set Admin Password** in your environment variables:
   ```bash
   # .env (local development)
   ADMIN_PASSWORD=your_secure_password_here
   ```

2. **For Production** (e.g., Vercel), set the environment variable:
   - Go to your project settings
   - Add `ADMIN_PASSWORD` with a strong password
   - Redeploy your application

### Access Admin Panel

1. Navigate to `/admin` or any admin route (e.g., `/admin/books`, `/admin/orders`)
2. You'll be redirected to `/admin/login` if not authenticated
3. Enter the password set in `ADMIN_PASSWORD`
4. Session lasts 24 hours
5. Use the "Logout" button to end your session

### Security Features

- ✅ **Password-protected**: All admin routes require authentication
- ✅ **Secure cookies**: HttpOnly cookies prevent XSS attacks
- ✅ **Session management**: Auto-logout after 24 hours
- ✅ **Server-side validation**: Password verification on the server
- ✅ **Client-side guard**: Quick redirect for unauthenticated access

### Admin Routes

All routes under `/admin` are protected:
- `/admin/books` - Book management (add, edit, delete)
- `/admin/orders` - Order management and tracking
- `/admin/promo-codes` - Promo code management
- `/admin/payment-links` - Payment link generation
- `/admin/profit-margins` - Profit margin analysis

**Important**: Choose a strong password and never commit `.env` files to version control!

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd baytul-iqra-bookstore
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with:
   ```bash
   DATABASE_URL="postgresql://username:password@localhost:5432/bookstore"
   STRIPE_PUBLISHABLE_KEY="your_stripe_publishable_key"
   STRIPE_SECRET_KEY="your_stripe_secret_key"
   ADMIN_PASSWORD="your_secure_admin_password"
   NEXT_PUBLIC_BASE_URL="http://localhost:3000"
   ```

4. **Initialize the database**
   ```bash
   npm run db:migrate
   
   # (Optional) Seed database with sample data
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🛠️ Available Scripts

### Development
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Database Management
- `npm run db:backup` - **Create database backup** (JSON + CSV)
- `npm run db:restore` - **Restore from backup** (interactive)
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database (⚠️ destructive)
- `npm run db:seed` - Seed database with books from CSV
- `npx ts-node --project tsconfig.scripts.json scripts/syncProdToLocal.ts` - **Sync production data to local database**

### Promo Code Management
- `npx tsx scripts/addPromoCodes.ts` - Add sample promo codes to database

### Production Migrations
To apply schema changes to your production database (e.g., Neon), set the `DATABASE_URL` to your production connection string and run:
```sh
DATABASE_URL="your_production_url" npx prisma migrate deploy
```
This ensures your production database schema is up to date.

## 💾 Database Backup & Restore

A robust backup and restore system is in place to protect your data.

### Create a Backup
To create a full backup of your books and categories, run:
```bash
DATABASE_URL="YOUR_PROD_OR_LOCAL_DB_URL" 
npm run db:backup
```
This command:
- Connects to your database.
- Fetches all book data, including category relations.
- Creates a timestamped JSON backup file (e.g., `books-backup-2025-06-01T12-30-00-000Z.json`).
- Creates a `books-backup-latest.json` file, which is always a copy of the most recent backup.
- Stores all backups in the `backups/` directory.

### Restore from a Backup
To restore your database from a backup, run the interactive restore script:
```bash
npm run db:restore
```
The restoration script will:
1.  List all available backup files from the `backups/` directory.
2.  Prompt you to select which backup to restore from (defaults to the latest).
3.  Warn you if you are about to overwrite existing data.
4.  Delete existing book records if you confirm.
5.  Restore all books and their category relationships from the selected backup file.

### Backup Best Practices
- ✅ **Backup before major changes:** Always create a backup before running a database migration or making significant changes to your data.
- ✅ **Keep multiple versions:** The system automatically stores timestamped backups.
- ✅ **Store backups securely:** Consider committing your `backups/` directory to your Git repository or storing them in a secure cloud location.

### Sync Production to Local Development

To work with production data in your local development environment without affecting the live database:

```bash
npx ts-node --project tsconfig.scripts.json scripts/syncProdToLocal.ts
```

This script will:
1. 📦 **Export data** from your production database (Neon)
2. 🧹 **Clear** your local PostgreSQL database
3. 📥 **Import** all production data (books, categories, promo codes, orders)
4. ✅ **Verify** the import was successful
5. 🎉 Provide summary statistics

**Benefits:**
- ✅ Safe development with real data
- ✅ No risk of affecting production
- ✅ Work offline once synced
- ✅ Faster queries (local database)

**Note:** After syncing, restart your dev server to clear Next.js cache and see the new data.

## 🔧 Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Payments:** Stripe integration with discount support
- **Styling:** Tailwind CSS
- **Deployment:** Vercel-ready
- **Performance Monitoring:** Integrated with [Vercel Speed Insights](https://vercel.com/docs/analytics/speed-insights) for real user performance metrics
- **Email Service:** Resend (order confirmation emails)
- **Discount System:** Custom promo code validation and management

## 🔒 Data Safety

- **Automatic backups** before major operations
- **Transaction safety** with Prisma
- **Input validation** for all book data
- **Rollback capability** via restore system

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Manual Deployment
```bash
npm run build
npm start
```

## Testing

This project uses Playwright for end-to-end testing with a comprehensive test suite following best practices.

### Test Structure

```
tests/
├── e2e/                    # End-to-end test files
│   ├── book-purchase.spec.ts
│   ├── search-functionality.spec.ts
│   └── cart-management.spec.ts
├── pages/                  # Page Object Models
│   ├── base.page.ts
│   ├── home.page.ts
│   ├── cart.page.ts
│   └── checkout-success.page.ts
├── fixtures/               # Test fixtures and setup
│   ├── base-test.ts
│   └── test-data.ts
└── helpers/                # Helper utilities
    ├── api.helper.ts
    └── wait.helper.ts
```

### Running Tests

```bash
# Run all tests (local config)
npm test

# Run tests in headed mode
npx playwright test --headed

# Run specific test file
npx playwright test tests/e2e/book-purchase.spec.ts

# Run tests with UI
npx playwright test --ui

# Generate test report
npx playwright show-report test-results/html-report
```

### Test Configuration

Two configurations are provided:

- **Local** (`playwright.config.local.ts`): For development with local server
- **Production** (`playwright.config.prod.ts`): For CI/CD and production testing

Use production config:
```bash
NODE_ENV=production npm test
```

### Writing Tests

Tests follow these best practices:

1. **Page Object Model**: All page interactions through page objects
2. **Test-ID Locators**: Uses `data-testid` attributes for reliable selectors
3. **Descriptive Names**: Clear test descriptions following user intent
4. **Single Assertion**: One test per specific behavior/outcome
5. **Test Isolation**: Each test is independent and can run in parallel
6. **API Test Data**: Uses API helper to create test data

Example test:

```typescript
test('should add a book to cart from search results', async ({ homePage }) => {
  await homePage.navigate();
  await homePage.searchForBook('The Sealed Nectar');
  await homePage.addBookToCart(bookId);
  
  const toastVisible = await homePage.isToastVisible('Added to cart!');
  expect(toastVisible).toBe(true);
});
```

### Debugging Tests

```bash
# Debug mode
npx playwright test --debug

# Generate trace
npx playwright test --trace on

# View trace
npx playwright show-trace test-results/trace.zip
```

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── admin/             # Admin pages
│   ├── books/             # Book pages
│   ├── cart/              # Cart page
│   └── checkout/          # Checkout pages
├── components/            # React components
├── lib/                   # Utility libraries
└── generated/             # Generated Prisma client

prisma/
├── schema.prisma          # Database schema
└── migrations/            # Database migrations

tests/                     # Test files
scripts/                   # Utility scripts
```

## Database Scripts

```bash
# Create backup
npm run db:backup

# Restore from backup
npm run db:restore

# Update book images
npm run db:update-images

# View database in browser
npm run studio
```

## Admin Panel

Access the admin panel at `/admin` to:
- Manage books and inventory
- View and manage orders
- Create promo codes
- Generate payment links for in-person sales

## Technologies

- **Framework**: Next.js 15
- **Database**: PostgreSQL (Production) / SQLite (Development)
- **ORM**: Prisma
- **Payments**: Stripe
- **Email**: Resend
- **Styling**: Tailwind CSS
- **Testing**: Playwright
- **Language**: TypeScript

## License

Private - All rights reserved
