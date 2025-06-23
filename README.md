# Baytul Iqra Bookstore

A modern Islamic bookstore built with Next.js, featuring a comprehensive collection of Islamic literature, children's books, games, and educational materials.

## 📚 About

Baytul Iqra Bookstore is an online Islamic bookstore offering:
- **84+ Books** across multiple Islamic categories
- **Smart categorization** - Hadith & Sunnah, Quran & Tafsir, Children's Books, Biography & Seerah, and more
- **Author management** - Proper attribution for Islamic scholars and contemporary authors
- **E-commerce features** - Shopping cart, checkout, and inventory management
- **Responsive design** - Works on desktop and mobile devices

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

---

Built with ❤️ for the Islamic community
