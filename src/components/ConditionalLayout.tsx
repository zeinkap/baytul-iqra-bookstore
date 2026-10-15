'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import ChatWidget from './ChatWidget';

export default function ConditionalLayout({ 
  categories,
  children 
}: { 
  categories: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');
  // QR scan landing pages (/b/<code>) are a focused buy screen: no navbar, footer or chat button
  const isScanRoute = pathname.startsWith('/b/');

  return (
    <>
      {!isAdminRoute && !isScanRoute && <Header categories={categories} />}
      <div className="min-h-screen flex flex-col bg-white">
        <main className="flex-1">{children}</main>
        {!isAdminRoute && !isScanRoute && <Footer />}
      </div>
      {!isAdminRoute && !isScanRoute && <ChatWidget />}
    </>
  );
}

