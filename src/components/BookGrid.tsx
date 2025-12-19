"use client";
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AddToCartButtonClient from '@/components/AddToCartButtonClient';
import { useWishlist } from '@/components/WishlistProvider';
import { toast } from 'react-hot-toast';


export type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  format?: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
};

interface BookGridProps {
  initialBooks: Book[];
  searchQuery?: string;
  selectedCategories?: string[];
  selectedPriceRange?: string | null;
  quickViewBook?: Book | null;
  setQuickViewBook?: (book: Book | null) => void;
}

export default function BookGrid({ initialBooks, searchQuery = '', selectedCategories = [], selectedPriceRange = null, setQuickViewBook }: BookGridProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const isValidImageSrc = (src: unknown): src is string => {
    return (
      typeof src === 'string' &&
      src.trim().length > 0 &&
      (src.startsWith('/') || /^https?:\/\//.test(src))
    );
  };

  // Price range filter function
  const matchesPriceRange = (price: number, range: string | null): boolean => {
    if (!range) return true;
    switch (range) {
      case 'under-10':
        return price < 10;
      case '10-25':
        return price >= 10 && price <= 25;
      case '25-50':
        return price > 25 && price <= 50;
      case '50-plus':
        return price > 50;
      default:
        return true;
    }
  };

  // Combined filter: search query, selected categories, and price range
  const displayedBooks = initialBooks.filter((book) => {
    const matchesSearch =
      !searchQuery ||
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategories.length === 0 ||
      book.categories.some(cat => selectedCategories.includes(cat));
    const matchesPrice = matchesPriceRange(book.price, selectedPriceRange);
    return matchesSearch && matchesCategory && matchesPrice;
  });

  // Use displayedBooks directly since we removed sorting functionality
  const sortedBooks = displayedBooks;



  return (
    <div className="py-8 sm:py-12 md:py-16">
      {/* Show total number of books when no filters are applied */}
      {selectedCategories.length === 0 && !searchQuery && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-3 sm:mb-4 text-left">
          <span className="inline-block bg-emerald-50 text-emerald-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm">
            Showing {displayedBooks.length} book{displayedBooks.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Books Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div
          id="book-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8 pb-8 sm:pb-12 md:pb-16"
        >
          {displayedBooks.length === 0 && (
            <div className="col-span-full text-center py-16">
              <div className="max-w-md mx-auto">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  {searchQuery ? 'No books found' : 'No books available'}
                </h3>
                                 <p className="text-gray-500">
                  {searchQuery ? `Try adjusting your search for '${searchQuery}'` : 'Check back later for new arrivals'}
                </p>
              </div>
            </div>
          )}
          {sortedBooks.map((book, idx) => {
            const validImages = Array.isArray(book.images)
              ? book.images.filter(isValidImageSrc)
              : [];
            const firstImage = validImages[0] || '/placeholder.svg';
            const secondImage = validImages[1];
            return (
            <div key={book.id} className="group">
              <div 
                className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl border border-white/50 overflow-hidden transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                data-testid={`book-card-${book.id}`}
              >
                <Link href={`/books/${book.id}`} className="block">
                  {/* Book Image */}
                  <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-50 to-gray-100 p-4">
                    {/* First image (default) */}
                    <Image
                      src={firstImage}
                      alt={book.title}
                      fill
                      className={`object-contain drop-shadow-lg transition-opacity duration-500 ${hoveredIndex === idx && secondImage ? 'opacity-0' : 'opacity-100'}`}
                      sizes="(max-width: 768px) 50vw, 25vw"
                      priority={idx < 8} // Prioritize first 8 images
                      loading={idx < 8 ? 'eager' : 'lazy'}
                      style={{ objectFit: 'contain' }}
                    />
                    {/* Second image (on hover, if exists) */}
                    {secondImage && (
                      <Image
                        src={secondImage}
                        alt={book.title + ' alternate'}
                        fill
                        className={`object-contain drop-shadow-lg absolute inset-0 transition-opacity duration-500 ${hoveredIndex === idx ? 'opacity-100' : 'opacity-0'}`}
                        sizes="(max-width: 768px) 50vw, 25vw"
                        priority={false}
                        loading="lazy"
                        style={{ objectFit: 'contain' }}
                      />
                    )}
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
                    {/* Wishlist Heart Icon */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const validImages = Array.isArray(book.images)
                          ? book.images.filter((src) => typeof src === 'string' && src.trim().length > 0)
                          : [];
                        const firstImage = validImages[0] || '/placeholder.svg';
                        
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
                      className="absolute top-3 left-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 z-10"
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
                    {/* Quick View Button - appears on hover */}
                    <div className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${hoveredIndex === idx ? 'opacity-100' : 'opacity-0'}`}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setQuickViewBook?.(book);
                        }}
                        className="px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        Quick View
                      </button>
                    </div>
                  </div>
                  
                  {/* Book Details */}
                  <div className="p-4 sm:p-5 md:p-6 pb-3 sm:pb-4">
                    <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-1.5 sm:mb-2 line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200 leading-tight" data-testid={`book-title-${book.id}`}>
                      {book.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-1">by {book.author}</p>
                    
                    {/* Book Format */}
                    {book.format && (
                      <div className="mb-2 sm:mb-3">
                        <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium border border-blue-100">
                          {book.format}
                        </span>
                      </div>
                    )}
                    
                    {/* Categories */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                      {book.categories && book.categories.length > 0 && book.categories.slice(0, 2).map((cat) => (
                        <span key={cat} className="inline-block bg-emerald-50 text-emerald-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium border border-emerald-100">
                          {cat}
                        </span>
                      ))}
                      {book.categories && book.categories.length > 2 && (
                        <span className="inline-block bg-gray-50 text-gray-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium border border-gray-200">
                          +{book.categories.length - 2}
                        </span>
                      )}
                    </div>
                    
                    {/* Price */}
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xl sm:text-2xl font-bold text-emerald-600">${book.price.toFixed(2)}</span>
                        </div>
                        <span className="text-xs text-gray-500 mt-0.5 sm:mt-1">Tax included</span>
                      </div>
                    </div>
                  </div>
                </Link>
                
                {/* Add to Cart button integrated into card */}
                <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6">
                  <div 
                    className="w-full transform transition-all duration-200 group-hover:scale-105"
                    onClick={(e) => e.preventDefault()}
                  >
                    <div className="w-full">
                      <AddToCartButtonClient id={book.id} title={book.title} author={book.author} price={book.price} image={firstImage || ''} stock={book.stock} format={book.format} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

    </div>
  );
} 