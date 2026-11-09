"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type NavLink = { href: string; label: string };
type NavGroup = { label: string; items: NavLink[] };

// Related pages share one menu so the bar stays short. A group with one item is a plain link.
const NAV: NavGroup[] = [
  {
    label: 'Catalog',
    items: [
      { href: '/admin/books', label: 'Books' },
      { href: '/admin/paintings', label: 'Paintings' },
      { href: '/admin/stock-counts', label: 'Stock Counts' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders' },
      { href: '/admin/record-sale', label: 'Record Sale' },
      { href: '/admin/promo-codes', label: 'Promo Codes' },
      { href: '/admin/payment-links', label: 'Payment Links' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/admin/insights', label: 'Insights' },
      { href: '/admin/profit-margins', label: 'Profit Margins' },
      { href: '/admin/scans', label: 'QR Scans' },
    ],
  },
  { label: 'Requests', items: [{ href: '/admin/feedback', label: 'Requests' }] },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // Close an open menu when clicking elsewhere or pressing Escape
  useEffect(() => {
    if (!openGroup) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openGroup]);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const tabClass = (active: boolean) =>
    `py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
      active ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  return (
    <nav ref={navRef} className="bg-white border-b border-gray-200 mb-6 shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6 sm:space-x-8">
            <Link
              href="/"
              className="py-4 px-1 text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors"
              title="Back to Store"
            >
              ← Store
            </Link>
            {NAV.map((group) => {
              const active = group.items.some((item) => pathname === item.href);
              if (group.items.length === 1) {
                const [item] = group.items;
                return (
                  <Link key={item.href} href={item.href} className={tabClass(active)} onClick={() => setOpenGroup(null)}>
                    {item.label}
                  </Link>
                );
              }
              const open = openGroup === group.label;
              return (
                <div key={group.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : group.label)}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    className={`${tabClass(active)} inline-flex items-center gap-1`}
                  >
                    {group.label}
                    <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {open && (
                    <div role="menu" className="absolute left-0 top-full z-30 mt-px min-w-[11rem] rounded-b-lg border border-gray-200 bg-white py-1 shadow-lg">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setOpenGroup(null)}
                          className={`block px-4 py-2 text-sm ${
                            pathname === item.href ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
