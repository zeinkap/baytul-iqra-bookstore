import { headers } from 'next/headers';
import { HERO_CAROUSEL_BOOK_IDS } from '@/config/heroCarouselBooks';
import HeroCarousel from '@/components/HeroCarousel';
import HomePageClient from '@/components/HomePageClient';

// Define a Book type matching the Prisma model for use in the app directory
export type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  isBestseller: boolean;
  categories: string[];
  createdAt: string;
  updatedAt: string;
};

async function getBooks() {
  const h = await headers();
  const host = h.get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;
  const res = await fetch(`${baseUrl}/api/books`, { 
    next: { revalidate: 300 } // Cache for 5 minutes
  });
  if (!res.ok) return [];
  return res.json();
}

async function getCategories() {
  const h = await headers();
  const host = h.get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;
  const res = await fetch(`${baseUrl}/api/books/categories`, { 
    next: { revalidate: 3600 } // Cache for 1 hour
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function HomePage() {
  const books: Book[] = await getBooks();
  const categories: string[] = await getCategories();

  // Select books for the hero carousel
  let heroBooks: Book[] = [];
  if (HERO_CAROUSEL_BOOK_IDS && HERO_CAROUSEL_BOOK_IDS.length > 0) {
    heroBooks = HERO_CAROUSEL_BOOK_IDS
      .map(id => books.find(b => b.id === id))
      .filter(Boolean) as Book[];
  } else {
    heroBooks = [...books]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }



  // Get bestsellers from database
  const bestsellers = books
    .filter(book => book.isBestseller)
    .slice(0, 10);

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Hero Section with enhanced design */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <section className="relative rounded-3xl overflow-hidden mb-16 bg-gradient-to-br from-emerald-100 via-white to-amber-100 shadow-2xl border border-white/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_50%)]"></div>
          <div className="relative py-20 px-8 md:px-20 flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 max-w-2xl">
              <div className="inline-flex items-center bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Authentic Islamic Literature
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Baytul Iqra
                </span>
                <br />
                <span className="text-3xl lg:text-5xl text-gray-700">Islamic Bookstore</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-xl leading-relaxed">
                Discover a carefully curated collection of Islamic books for all ages. From spiritual guidance to scholarly works—find your next meaningful read.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a 
                  href="#book-grid" 
                  className="inline-flex items-center justify-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Shop Collection
                </a>
                <a 
                  href="#search-section" 
                  className="inline-flex items-center justify-center bg-white text-gray-700 px-8 py-4 rounded-xl font-semibold shadow-md hover:shadow-lg border border-gray-200 hover:border-gray-300 transition-all duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Browse Books
                </a>
              </div>
            </div>
            <div className="flex-1 flex justify-center lg:justify-end">
              <HeroCarousel heroBooks={heroBooks} />
            </div>
          </div>
        </section>
      </div>

      <HomePageClient 
        books={books}
        categories={categories}
        bestsellers={bestsellers}
      />
    </main>
  );
}