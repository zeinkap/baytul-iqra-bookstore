import './globals.css';
import type { Metadata } from 'next';
import { Inter, Merriweather } from 'next/font/google';
import { CartProvider } from '@/components/CartProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Toaster } from 'react-hot-toast';
import { headers } from 'next/headers';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const merriweather = Merriweather({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-merriweather', display: 'swap' });

export const metadata: Metadata = {
  title: 'Baytul Iqra Bookstore',
  description: 'Online Islamic Bookstore',
};

async function getCategories() {
  const h = await headers();
  const host = h.get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;
  const res = await fetch(`${baseUrl}/api/books/categories`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories: string[] = await getCategories();
  return (
    <html lang="en" className={`${inter.variable} ${merriweather.variable} bg-white`}>
      <body className="font-sans bg-white">
        <CartProvider>
          <Toaster position="top-right" />
          <Header categories={categories} />
          <div className="min-h-screen flex flex-col bg-white">
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </CartProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
