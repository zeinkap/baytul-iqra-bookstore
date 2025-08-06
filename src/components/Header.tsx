"use client";
import Link from 'next/link';
import Image from 'next/image';
import CartIconClient from './CartIconClient';
import { useState, useEffect } from 'react';

export default function Header({ categories }: { categories: string[] }) {
  // Sort categories: all except 'Other' alphabetically, then 'Other' last
  const sortedCategories = [
    ...categories.filter((c) => c !== 'Other').sort((a, b) => a.localeCompare(b)),
    ...categories.filter((c) => c === 'Other'),
  ];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [mobileBooksOpen, setMobileBooksOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg shadow-sm border-b border-gray-100/50">
      <div className="max-w-7xl mx-auto">
        {/* Main header bar */}
        <div className="flex items-center justify-between px-4 lg:px-6 py-4">
          {/* Left side - mobile menu button and logo */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button - rendered first (left corner) */}
            {mounted && (
              <div className="lg:hidden">
                <button 
                  onClick={toggleMobileMenu}
                  className="p-2.5 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all duration-200"
                  aria-label="Toggle mobile menu"
                >
                  {isMobileMenuOpen ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            )}
            
            {/* Logo and brand section - rendered after mobile menu button */}
            <Link href="/" className="group flex items-center gap-3 hover:scale-105 transition-transform duration-200">
              {/* Logo image */}
              <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-200 bg-white">
                <Image
                  src="/logo-baytul-iqra.png"
                  alt="Baytul Iqra Logo"
                  width={48}
                  height={48}
                  className="object-contain w-12 h-12"
                  priority
                />
              </div>
              {/* Brand name with enhanced typography */}
              <div className="flex flex-col">
                <span className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent tracking-tight">
                  Baytul Iqra
                </span>
                <span className="text-xs text-gray-500 font-medium -mt-1 tracking-wide">
                  ISLAMIC BOOKSTORE
                </span>
              </div>
            </Link>
            
            {/* Navigation menu - hidden on mobile */}
            <nav className="hidden lg:flex items-center gap-1">
              {/* Categories Dropdown */}
              <div className="relative">
                <button
                  onMouseEnter={() => setIsCategoriesOpen(true)}
                  onMouseLeave={() => setIsCategoriesOpen(false)}
                  className="px-4 py-2.5 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl font-medium transition-all duration-200 text-sm flex items-center gap-1"
                >
                  Books
                  <svg className={`w-3 h-3 transition-transform duration-200 ${isCategoriesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* Dropdown Menu */}
                <div 
                  className={`absolute top-full left-0 mt-1 w-64 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl transition-all duration-200 ${
                    isCategoriesOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                  }`}
                  onMouseEnter={() => setIsCategoriesOpen(true)}
                  onMouseLeave={() => setIsCategoriesOpen(false)}
                >
                  <div className="py-2">
                    {sortedCategories.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-400">No categories</div>
                    ) : (
                      sortedCategories.map((category) => (
                      <Link
                        key={category}
                        href={`/?category=${encodeURIComponent(category)}#book-grid`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 transition-colors duration-200"
                        onClick={() => setIsCategoriesOpen(false)}
                      >
                        {category}
                      </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <Link
                href="/contact"
                className="px-4 py-2.5 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl font-medium transition-all duration-200 text-sm"
              >
                Contact
              </Link>
            </nav>
          </div>

          {/* Right side - cart only */}
          <div className="flex items-center">
            {/* Cart icon */}
            <div className="relative">
              <CartIconClient />
            </div>
          </div>
        </div>

        {/* Mobile navigation menu with animation */}
        {mounted && (
          <div className={`lg:hidden border-t border-gray-100 transition-all duration-300 ease-in-out ${
            isMobileMenuOpen 
              ? 'max-h-96 opacity-100' 
              : 'max-h-0 opacity-0 overflow-hidden'
          }`}>
          <nav className="px-4 py-3 space-y-1">
            {/* Mobile Books Dropdown */}
            <div>
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide focus:outline-none"
                onClick={() => setMobileBooksOpen((open) => !open)}
                aria-expanded={mobileBooksOpen}
                aria-controls="mobile-books-dropdown"
              >
                Books
                <svg className={`w-4 h-4 ml-2 transition-transform duration-200 ${mobileBooksOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                id="mobile-books-dropdown"
                className={`transition-all duration-200 overflow-hidden bg-gray-50 rounded-lg shadow-inner border border-gray-100 mt-1 ${
                  mobileBooksOpen ? 'max-h-64 opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'
                }`}
                style={{ minWidth: 0 }}
              >
                {sortedCategories.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">No categories</div>
                ) : (
                  sortedCategories.map((category) => (
                    <Link
                      key={category}
                      href={`/?category=${encodeURIComponent(category)}#book-grid`}
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setMobileBooksOpen(false);
                      }}
                      className="block px-3 py-2 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-all duration-200 text-sm pl-8"
                    >
                      {category}
                    </Link>
                  ))
                )}
              </div>
            </div>
            <Link
              href="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg font-medium transition-all duration-200 text-sm"
            >
              Contact
            </Link>
          </nav>
        </div>
        )}
      </div>
    </header>
  );
} 