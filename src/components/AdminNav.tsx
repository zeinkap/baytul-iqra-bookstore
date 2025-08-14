"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin/books', label: 'Books' },
    { href: '/admin/orders', label: 'Orders' },
    { href: '/admin/promo-codes', label: 'Promo Codes' },
    { href: '/admin/payment-links', label: 'Payment Links' },
  ];

  return (
    <nav className="bg-gray-100 border-b border-gray-200 mb-6">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                pathname === item.href
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
} 