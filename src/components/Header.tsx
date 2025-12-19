"use client";
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import CartIconBadge from './CartIconBadge';
import { useWishlist } from './WishlistProvider';
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
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const { wishlist, isHydrated } = useWishlist();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const isActive = (path: string) => pathname === path;

  return (
    <header className={`sticky top-0 z-50 bg-white/98 backdrop-blur-md border-b transition-all duration-300 ${
      isScrolled 
        ? 'shadow-md border-gray-200/80' 
        : 'shadow-sm border-gray-100/50'
    }`}>
      <div className="max-w-7xl mx-auto">
        {/* Main header bar */}
        <div className={`flex items-center justify-between px-4 lg:px-6 transition-all duration-300 ${
          isScrolled ? 'py-3' : 'py-4'
        }`}>
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
            <Link href="/" className="group flex items-center gap-3 hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-lg">
              {/* Logo image */}
              <div className={`rounded-xl overflow-hidden flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100/50 ${
                isScrolled ? 'w-10 h-10' : 'w-12 h-12'
              }`}>
                <Image
                  src="/logo-baytul-iqra.png"
                  alt="Baytul Iqra Logo"
                  width={48}
                  height={48}
                  className={`object-contain transition-all duration-200 ${
                    isScrolled ? 'w-10 h-10' : 'w-12 h-12'
                  }`}
                  priority
                />
              </div>
              {/* Brand name with enhanced typography */}
              <div className="flex flex-col">
                <span className={`font-bold bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent tracking-tight transition-all duration-200 ${
                  isScrolled ? 'text-xl' : 'text-2xl'
                }`}>
                  Baytul Iqra
                </span>
                <span className={`text-gray-500 font-medium tracking-wide transition-all duration-200 ${
                  isScrolled ? 'text-[10px] -mt-0.5' : 'text-xs -mt-1'
                }`}>
                  ISLAMIC BOOKSTORE
                </span>
              </div>
            </Link>
            
            {/* Navigation menu - hidden on mobile */}
            <nav className="hidden lg:flex items-center gap-2">
              {/* Categories Dropdown */}
              <div className="relative">
                <button
                  onMouseEnter={() => setIsCategoriesOpen(true)}
                  onMouseLeave={() => setIsCategoriesOpen(false)}
                  className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm flex items-center gap-1.5 relative ${
                    pathname === '/' 
                      ? 'text-emerald-700 bg-emerald-50/80' 
                      : 'text-gray-700 hover:text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Books
                  <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isCategoriesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* Dropdown Menu */}
                <div 
                  className={`absolute top-full left-0 mt-2 w-64 bg-white/98 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-2xl transition-all duration-200 ${
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
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:text-emerald-700 hover:bg-emerald-50/80 transition-all duration-200 rounded-lg mx-1"
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
                className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm ${
                  isActive('/contact')
                    ? 'text-emerald-700 bg-emerald-50/80'
                    : 'text-gray-700 hover:text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Contact
              </Link>
            </nav>
          </div>

          {/* Right side - wishlist and cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Wishlist icon with label */}
            <Link
              href="/wishlist"
              className={`relative flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                isActive('/wishlist')
                  ? 'text-red-600 bg-red-50/80'
                  : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
              }`}
              aria-label="Wishlist"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
                fill={isHydrated && wishlist.length > 0 ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {isHydrated && wishlist.length > 0 && (
                <span className="absolute top-0 right-0 bg-gradient-to-r from-red-500 to-red-600 text-white text-[9px] sm:text-[10px] font-bold rounded-full w-4 h-4 sm:w-4.5 sm:h-4.5 flex items-center justify-center shadow-lg -translate-y-1 translate-x-1 ring-2 ring-white">
                  {wishlist.length > 9 ? '9+' : wishlist.length}
                </span>
              )}
              <span className="text-[10px] sm:text-sm font-medium whitespace-nowrap leading-tight">
                Wishlist
              </span>
            </Link>
            {/* Cart icon with label */}
            <div className="relative">
              <Link 
                href="/cart" 
                className={`relative inline-flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                  isActive('/cart')
                    ? 'text-emerald-700 bg-emerald-50/80'
                    : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50'
                }`}
                data-testid="cart-icon"
              >
                <div className="relative">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119.993zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                  <CartIconBadge />
                </div>
                <span className="text-[10px] sm:text-sm font-medium whitespace-nowrap leading-tight">
                  Cart
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile navigation menu with animation */}
        {mounted && (
          <div className={`lg:hidden border-t transition-all duration-300 ease-in-out ${
            isMobileMenuOpen 
              ? 'max-h-96 opacity-100 border-gray-200/80' 
              : 'max-h-0 opacity-0 overflow-hidden border-transparent'
          }`}>
          <nav className="px-4 py-3 space-y-1 bg-gradient-to-b from-white to-gray-50/30">
            {/* Mobile Books Dropdown */}
            <div>
              <button
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg transition-all duration-200 ${
                  pathname === '/' 
                    ? 'text-emerald-700 bg-emerald-50/80' 
                    : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50'
                }`}
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
                className={`transition-all duration-200 overflow-hidden bg-white/80 backdrop-blur-sm rounded-lg shadow-inner border border-gray-200/50 mt-1.5 ${
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
                      className="block px-3 py-2.5 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50/80 rounded-lg transition-all duration-200 text-sm pl-6 mx-1"
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
              className={`block px-3 py-2.5 rounded-lg font-medium transition-all duration-200 text-sm ${
                isActive('/contact')
                  ? 'text-emerald-700 bg-emerald-50/80'
                  : 'text-gray-700 hover:text-emerald-700 hover:bg-emerald-50/80'
              }`}
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