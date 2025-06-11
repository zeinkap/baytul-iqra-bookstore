import Image from 'next/image';
import { headers } from 'next/headers';
import BookGrid from '@/components/BookGrid';

// Define a Book type matching the Prisma model for use in the app directory
export type Book = {
  id: number;
  title: string;
  author: string;
  description: string;
  price: number;
  image: string;
  stock: number;
  category: string;
  createdAt: string;
  updatedAt: string;
};

async function getBooks() {
  const h = await headers();
  const host = h.get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;
  const res = await fetch(`${baseUrl}/api/books`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function HomePage() {
  const books: Book[] = await getBooks();

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
                <span className="text-3xl lg:text-5xl text-gray-700">Bookstore</span>
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
                  href="#book-grid" 
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
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-3xl rotate-6 opacity-20"></div>
                <Image 
                  src="/book-hero.png" 
                  alt="Islamic Books Collection" 
                  width={400} 
                  height={400} 
                  className="relative rounded-3xl shadow-2xl transform -rotate-2 hover:rotate-0 transition-transform duration-500" 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-8 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Curated Collection</h3>
            <p className="text-gray-600">Carefully selected Islamic books from renowned scholars and authors</p>
          </div>
          <div className="text-center p-8 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Fast Delivery</h3>
            <p className="text-gray-600">Quick and secure shipping to bring knowledge to your doorstep</p>
          </div>
          <div className="text-center p-8 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">For All Ages</h3>
            <p className="text-gray-600">Books suitable for children, youth, and adults on their spiritual journey</p>
          </div>
        </div>
      </div>

      {/* Book Grid with Search */}
      <div className="bg-white/50">
        <BookGrid initialBooks={books} />
      </div>
    </main>
  );
}