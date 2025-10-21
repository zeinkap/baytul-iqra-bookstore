"use client";
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AddToCartButtonClient from '@/components/AddToCartButtonClient';


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
}

export default function BookGrid({ initialBooks, searchQuery = '', selectedCategories = [] }: BookGridProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const isValidImageSrc = (src: unknown): src is string => {
    return (
      typeof src === 'string' &&
      src.trim().length > 0 &&
      (src.startsWith('/') || /^https?:\/\//.test(src))
    );
  };

  // Combined filter: search query and selected categories
  const displayedBooks = initialBooks.filter((book) => {
    const matchesSearch =
      !searchQuery ||
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategories.length === 0 ||
      book.categories.some(cat => selectedCategories.includes(cat));
    return matchesSearch && matchesCategory;
  });

  // Use displayedBooks directly since we removed sorting functionality
  const sortedBooks = displayedBooks;



  return (
    <div className="py-16">
      {/* Show total number of books when no filters are applied */}
      {selectedCategories.length === 0 && !searchQuery && (
        <div className="max-w-6xl mx-auto px-4 mb-4 text-left">
          <span className="inline-block bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full font-medium text-sm">
            Showing {displayedBooks.length} book{displayedBooks.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Books Grid */}
      <div className="max-w-7xl mx-auto px-4">
        <div
          id="book-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-16"
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
                  </div>
                  
                  {/* Book Details */}
                  <div className="p-6 pb-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200">
                      {book.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">by {book.author}</p>
                    
                    {/* Book Format */}
                    {book.format && (
                      <div className="mb-3">
                        <span className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-medium border border-blue-100">
                          {book.format}
                        </span>
                      </div>
                    )}
                    
                    {/* Categories */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {book.categories && book.categories.length > 0 && book.categories.map((cat) => (
                        <span key={cat} className="inline-block bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium border border-emerald-100">
                          {cat}
                        </span>
                      ))}
                    </div>
                    
                    {/* Price */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-emerald-600">${book.price.toFixed(2)}</span>
                        </div>
                        <span className="text-xs text-gray-500 mt-1">Tax included</span>
                      </div>
                    </div>
                  </div>
                </Link>
                
                {/* Add to Cart button integrated into card */}
                <div className="px-6 pb-6">
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