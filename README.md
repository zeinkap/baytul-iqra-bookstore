# Baytul Iqra Bookstore

A modern Islamic bookstore built with Next.js, featuring a comprehensive collection of Islamic literature, children's books, games, and educational materials.

🌐 **Live Site**: [https://www.baytuliqra.com](https://www.baytuliqra.com/)

## 📚 About

Baytul Iqra Bookstore is an online Islamic bookstore offering:
- **84+ Books** across multiple Islamic categories
- **Smart categorization** - Hadith & Sunnah, Quran & Tafsir, Children's Books, Biography & Seerah, and more
- **Author management** - Proper attribution for Islamic scholars and contemporary authors
- **E-commerce features** - Shopping cart, checkout, order management, and inventory management
- **Order Management** - Orders are created via the `/api/orders` endpoint and stored in the `Order` table (PostgreSQL, Prisma). Supports both shipping and pickup fulfillment types. Order data includes cart items, total, fulfillment type, pickup location, shipping address, and customer email.
- **Responsive design** - Works on desktop and mobile devices

## 🛒 Order Management

- Orders are created through the `/api/orders` API endpoint.
- The `Order` table (managed by Prisma/PostgreSQL) stores all order details, including:
  - Cart items (JSON)
  - Total price
  - Fulfillment type (shipping or pickup)
  - Pickup location or shipping address
  - Customer email
- Supports both shipping and pickup workflows.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm

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
   ```

4. **Initialize the database**
   ```bash
   npm run db:migrate
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

## 🔧 Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Payments:** Stripe integration
- **Styling:** Tailwind CSS
- **Deployment:** Vercel-ready
- **Performance Monitoring:** Integrated with [Vercel Speed Insights](https://vercel.com/docs/analytics/speed-insights) for real user performance metrics
- **Email Service:** Resend (order confirmation emails)

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
npm run start
```

## 📡 API Endpoints

- `GET /api/books` — List all books
- `GET /api/books/categories` — List all categories
- `GET /api/books/category/[category]` — List books by category
- `GET /api/books/[id]` — Get book details
- `POST /api/orders` — Create a new order
- `POST /api/checkout_sessions` — Create a Stripe checkout session
- `POST /api/stripe/webhook` — Stripe webhook for payment events

## 📞 Support

For issues or questions:
- Check existing backup files in `backups/` directory
- Review database scripts in `scripts/` directory
- Ensure environment variables are properly configured

## 🤝 Contributing

1. Create backups before making changes
2. Follow existing code patterns
3. Test database operations thoroughly
4. Update documentation as needed

## 📧 Order Confirmation Emails

This project uses [Resend](https://resend.com/) to send order confirmation emails to customers after a successful payment.

### How it works
- When a customer completes checkout and payment via Stripe, a webhook (`/api/stripe/webhook`) listens for the `checkout.session.completed` event.
- The webhook fetches the order details from the database and sends a confirmation email using Resend.
- Emails are only sent after payment is confirmed (not before or if payment fails/abandoned).

### Setup
1. **Sign up for a Resend account** at [resend.com](https://resend.com/) and obtain your API key.
2. **Add the following environment variable** to your `.env` file:
   ```bash
   RESEND_API_KEY="your_resend_api_key"
   ```
3. (Optional) Update the `from` address in `src/lib/sendEmail.ts` to match your verified sender domain.

### Customization
- The email content and logic can be found in `src/lib/sendEmail.ts`.
- The webhook handler is in `src/app/api/stripe/webhook.ts`.

**Note:** You must also set up your Stripe webhook endpoint in the Stripe dashboard to point to `/api/stripe/webhook` and provide the `STRIPE_WEBHOOK_SECRET` in your environment variables.

---

Built with ❤️ for the Islamic community
