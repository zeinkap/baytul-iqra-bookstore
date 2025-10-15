"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: '/admin/books', label: 'Books' },
    { href: '/admin/orders', label: 'Orders' },
    { href: '/admin/promo-codes', label: 'Promo Codes' },
    { href: '/admin/payment-links', label: 'Payment Links' },
    { href: '/admin/profit-margins', label: 'Profit Margins' },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      sessionStorage.removeItem('adminAuth');
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 mb-6 shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between">
          <div className="flex space-x-8">
            <Link
              href="/"
              className="py-4 px-1 text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors"
              title="Back to Store"
            >
              ← Store
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  pathname === item.href
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="py-2 px-4 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
} 