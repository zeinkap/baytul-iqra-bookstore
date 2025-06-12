"use client";
import Link from 'next/link';
import CartIconClient from './CartIconClient';
import { useState } from 'react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const categories = [
    'Quran & Tafsir',
    'Hadith & Sunnah',
    'Islamic History',
    'Fiqh & Islamic Law',
    'Aqeedah & Theology',
    'Biography & Seerah',
    'Children\'s Games',
    'Dua & Dhikr',
    'Children\'s Books',
    'Islamic Literature'
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg shadow-sm border-b border-gray-100/50">
      <div className="max-w-7xl mx-auto">
        {/* Main header bar */}
        <div className="flex items-center justify-between px-4 lg:px-6 py-4">
          {/* Logo and brand section */}
          <div className="flex items-center gap-8">
            <Link href="/" className="group flex items-center gap-3 hover:scale-105 transition-transform duration-200">
              {/* Logo icon */}
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-200">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              {/* Brand name with enhanced typography */}
              <div className="flex flex-col">
                <span className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent tracking-tight">
                  Baytul Iqra
                </span>
                <span className="text-xs text-gray-500 font-medium -mt-1 tracking-wide">
                  BOOKSTORE
                </span>
              </div>
            </Link>
            
            {/* Navigation menu - hidden on mobile */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link 
                href="/" 
                className="px-4 py-2.5 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl font-medium transition-all duration-200 text-sm"
              >
                Home
              </Link>
              <Link 
                href="/#book-grid" 
                className="px-4 py-2.5 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl font-medium transition-all duration-200 text-sm"
              >
                Shop
              </Link>
              
              {/* Categories Dropdown */}
              <div className="relative">
                <button
                  onMouseEnter={() => setIsCategoriesOpen(true)}
                  onMouseLeave={() => setIsCategoriesOpen(false)}
                  className="px-4 py-2.5 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl font-medium transition-all duration-200 text-sm flex items-center gap-1"
                >
                  Categories
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
                    {categories.map((category) => (
                      <Link
                        key={category}
                        href={`/?category=${encodeURIComponent(category)}#book-grid`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 transition-colors duration-200"
                        onClick={() => setIsCategoriesOpen(false)}
                      >
                        {category}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </nav>
          </div>

          {/* Right side - cart and mobile menu */}
        <div className="flex items-center gap-4">
            {/* Cart icon */}
            <div className="relative">
              <CartIconClient />
            </div>

            {/* Mobile menu button */}
            <button 
              onClick={toggleMobileMenu}
              className="lg:hidden p-2.5 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all duration-200"
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
        </div>

        {/* Mobile navigation menu with animation */}
        <div className={`lg:hidden border-t border-gray-100 transition-all duration-300 ease-in-out ${
          isMobileMenuOpen 
            ? 'max-h-96 opacity-100' 
            : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <nav className="px-4 py-3 space-y-1">
            <Link 
              href="/" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg font-medium transition-all duration-200 text-sm"
            >
              Home
            </Link>
            <Link 
              href="/#book-grid" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg font-medium transition-all duration-200 text-sm"
            >
              Shop
            </Link>
            
            {/* Mobile Categories */}
            <div className="pt-2">
              <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categories</div>
                             {categories.map((category) => (
                <Link
                  key={category}
                  href={`/?category=${encodeURIComponent(category)}#book-grid`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all duration-200 text-sm pl-6"
                >
                  {category}
          </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
} 