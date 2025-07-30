"use client";
import Link from 'next/link';
import CartIconBadge from './CartIconBadge';

export default function CartIcon() {
  return (
    <Link 
      href="/cart" 
      className="relative inline-flex items-center justify-center p-2.5 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all duration-200 group"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-6 h-6 transition-transform duration-200 group-hover:scale-110"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119.993zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
      <CartIconBadge />
    </Link>
  );
} 