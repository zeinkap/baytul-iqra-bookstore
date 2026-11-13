'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Loaded as separate chunks: the QR scan, basket and receipt screens never show them, so a customer's phone
// shouldn't download their code. Pages that do show them still render them on the server, so nothing pops in.
const Header = dynamic(() => import('./Header'));
const Footer = dynamic(() => import('./Footer'));
const ChatWidget = dynamic(() => import('./ChatWidget'));

export default function ConditionalLayout({ 
  categories,
  children 
}: { 
  categories: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');
  // QR scan landing pages (/b/<code>), the in-shop basket (/basket) and the in-shop receipt (/receipt) are focused screens: no navbar, footer or chat button
  const isScanRoute = pathname.startsWith('/b/') || pathname.startsWith('/receipt') || pathname.startsWith('/basket') || pathname.startsWith('/venue');

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

