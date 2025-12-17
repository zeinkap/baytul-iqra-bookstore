'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import SearchSection from './SearchSection';
import BookGrid from './BookGrid';
import { Book } from './BookGrid';
import { useWishlist } from './WishlistProvider';
import { toast } from 'react-hot-toast';
import QuickViewModal from './QuickViewModal';

interface HomePageClientProps {
  books: Book[];
  categories: string[];
  bestsellers: Book[];
}

export default function HomePageClient({ books, categories, bestsellers }: HomePageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [quickViewBook, setQuickViewBook] = useState<Book | null>(null);
  const [hoveredBestsellerIndex, setHoveredBestsellerIndex] = useState<number | null>(null);
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  // Check for category parameter in URL on mount and initialize state
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    if (categoryParam && categories.includes(categoryParam)) {
      setSelectedCategories([categoryParam]);
      // Clear the category parameter from URL after reading it
      urlParams.delete('category');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, [categories]);

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
  };

  const handlePriceRangeChange = (priceRange: string | null) => {
    setSelectedPriceRange(priceRange);
  };

  const isValidImageSrc = (src: unknown): src is string =>
    typeof src === 'string' && src.trim().length > 0 && (src.startsWith('/') || /^https?:\/\//.test(src));

  return (
    <>
      {/* Bestsellers Section */}
      {bestsellers.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-12 sm:mb-16">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-3 sm:gap-0">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">
                Bestsellers
              </h2>
              <p className="text-sm sm:text-base lg:text-lg text-gray-600">
                Most popular books in our collection
              </p>
            </div>
            <a 
              href="#book-grid" 
              className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold transition-colors duration-200 text-sm sm:text-base self-start sm:self-auto"
            >
              View All
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
            {bestsellers.map((book, index) => {
              const validImages = Array.isArray(book.images) ? book.images.filter(isValidImageSrc) : [];
              const firstImage = validImages[0] || '/placeholder.svg';
              return (
              <div key={book.id} className="group">
                <div 
                  className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl border border-white/50 overflow-hidden transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1"
                  onMouseEnter={() => setHoveredBestsellerIndex(index)}
                  onMouseLeave={() => setHoveredBestsellerIndex(null)}
                >
                  <a href={`/books/${book.id}`} className="block">
                    <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-50 to-gray-100 p-4">
                      <Image
                        src={firstImage}
                        alt={book.title}
                        fill
                        className="object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                        loading={index < 5 ? 'eager' : 'lazy'}
                        priority={index < 5}
                      />
                      <div className="absolute top-3 left-3">
                        <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                          #{index + 1}
                        </div>
                      </div>
                      {/* Stock indicator */}
                      <div className="absolute top-3 right-3">
                        <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          book.stock === 0 ? 'bg-red-100 text-red-800' : 
                          book.stock === 1 ? 'bg-amber-100 text-amber-800' : 
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {book.stock === 0 ? 'Out of Stock' : 
                           book.stock === 1 ? 'Only 1 left!' : 
                           'In Stock'}
                        </div>
                      </div>
                      {/* Quick View Button - appears on hover */}
                      <div className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${hoveredBestsellerIndex === index ? 'opacity-100' : 'opacity-0'}`}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setQuickViewBook(book);
                          }}
                          className="px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                        >
                          Quick View
                        </button>
                      </div>
                      {/* Wishlist Heart Icon */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isInWishlist(book.id)) {
                            removeFromWishlist(book.id);
                            toast.success(`"${book.title}" removed from wishlist`, {
                              style: {
                                background: '#ef4444',
                                color: '#fff',
                              },
                              iconTheme: {
                                primary: '#fff',
                                secondary: '#ef4444',
                              },
                            });
                          } else {
                            addToWishlist({
                              id: book.id,
                              title: book.title,
                              author: book.author,
                              price: book.price,
                              image: firstImage,
                              format: book.format,
                            });
                            toast.success(`"${book.title}" added to wishlist`, {
                              style: {
                                background: '#f59e0b',
                                color: '#fff',
                              },
                              iconTheme: {
                                primary: '#fff',
                                secondary: '#f59e0b',
                              },
                            });
                          }
                        }}
                        className="absolute bottom-3 left-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 z-10"
                        aria-label={isInWishlist(book.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                      >
                        <svg
                          className={`w-5 h-5 transition-colors duration-200 ${
                            isInWishlist(book.id)
                              ? 'text-red-500 fill-red-500'
                              : 'text-gray-400 hover:text-red-500'
                          }`}
                          fill={isInWishlist(book.id) ? 'currentColor' : 'none'}
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
                      </button>
                    </div>
                    <div className="p-3 sm:p-4">
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200 text-xs sm:text-sm leading-tight">
                        {book.title}
                      </h3>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-1">by {book.author}</p>
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-base sm:text-lg font-bold text-emerald-600">${book.price.toFixed(2)}</span>
                        <span className="text-xs text-gray-500">Tax included</span>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      <div id="search-section">
        <SearchSection 
          categories={categories}
          onSearch={handleSearch}
          onCategoryChange={handleCategoryChange}
          onPriceRangeChange={handlePriceRangeChange}
          initialSelectedCategories={selectedCategories}
        />
      </div>
      
      {/* Full Book Grid with Search */}
      <div className="bg-white/50">
        <BookGrid 
          initialBooks={books} 
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
          selectedPriceRange={selectedPriceRange}
        />
      </div>

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 sm:p-4 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group touch-manipulation"
          aria-label="Scroll to top"
        >
          <svg 
            className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:-translate-y-1" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        book={quickViewBook}
        isOpen={!!quickViewBook}
        onClose={() => setQuickViewBook(null)}
      />
    </>
  );
} 