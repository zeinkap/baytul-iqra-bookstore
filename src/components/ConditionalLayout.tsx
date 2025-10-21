'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';

export default function ConditionalLayout({ 
  categories,
  children 
}: { 
  categories: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <>
      {!isAdminRoute && <Header categories={categories} />}
      <div className="min-h-screen flex flex-col bg-white">
        <main className="flex-1">{children}</main>
        {!isAdminRoute && <Footer />}
      </div>
    </>
  );
}

