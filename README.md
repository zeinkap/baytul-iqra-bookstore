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

### Book Management
- `npm run books:add` - Add a single book to database
- `npm run authors:update` - Update authors for books with "Various Authors"

## 💾 Database Backup System

### Why Backup?
Protect your 84+ books, author information, and categories from data loss.

### Create Backup
```bash
npm run db:backup
```
Creates timestamped backups in `backups/` directory:
- **JSON format** - Complete structured data
- **CSV format** - Human-readable spreadsheet
- **Metadata** - Backup stats and distributions

### Restore from Backup
```bash
npm run db:restore
```
Interactive restoration process:
- Shows available backup files
- Warns before overwriting data
- Restores books, authors, and categories

### Backup Best Practices
- ✅ Backup before major changes
- ✅ Backup before running migration scripts
- ✅ Keep multiple backup versions
- ✅ Store backups in version control or cloud storage

## 📖 Book Categories

The bookstore organizes books into these categories:
- **Hadith & Sunnah** (41 books) - Prophetic traditions and teachings
- **Quran & Tafsir** (11 books) - Quranic studies and commentary
- **Children's Books** (7 books) - Islamic stories and learning
- **Children's Games** (7 books) - Educational games and activities
- **Islamic Literature** (6 books) - Contemporary Islamic writing
- **Biography & Seerah** (6 books) - Lives of prophets and companions
- **Dua & Dhikr** (2 books) - Prayers and remembrance
- **Fiqh & Islamic Law** (1 book) - Islamic jurisprudence
- **Hajj & Umrah** (1 book) - Pilgrimage and its rituals

## 🔧 Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Payments:** Stripe integration
- **Styling:** Tailwind CSS
- **Deployment:** Vercel-ready

## 📝 Adding New Books

### Method 1: Single Book Script
1. Edit `scripts/addSingleBook.ts`
2. Update book details (title, author, description, price, category)
3. Run: `npm run books:add`

### Method 2: Manual Database Entry
Use the interactive author management tool:
```bash
npm run authors:update
```

### Method 3: CSV Import
Add books to CSV and run:
```bash
npm run db:seed
```

## 🎯 Featured Authors

Notable Islamic scholars and authors in our collection:
- **Learning Roots** - Children's educational materials
- **Dr. Muhammad Ali al-Hashimi** - "The Ideal Muslim" series
- **Zaheer Khatri** - Contemporary Islamic literature
- **Omar Suleiman** - Social justice and reform
- **Ibn Kathir** - Classical Islamic scholarship
- **Imam al-Nawawi** - Hadith collections

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
