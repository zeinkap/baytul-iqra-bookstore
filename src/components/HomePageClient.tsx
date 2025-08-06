'use client';

import { useState } from 'react';
import Image from 'next/image';
import SearchSection from './SearchSection';
import BookGrid from './BookGrid';
import { Book } from './BookGrid';

interface HomePageClientProps {
  books: Book[];
  categories: string[];
  bestsellers: Book[];
}

export default function HomePageClient({ books, categories, bestsellers }: HomePageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
  };

  return (
    <>
      {/* Bestsellers Section */}
      {bestsellers.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                Bestsellers
              </h2>
              <p className="text-lg text-gray-600">
                Most popular books in our collection
              </p>
            </div>
            <a 
              href="#book-grid" 
              className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold transition-colors duration-200"
            >
              View All
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {bestsellers.map((book, index) => (
              <div key={book.id} className="group">
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl border border-white/50 overflow-hidden transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1">
                  <a href={`/books/${book.id}`} className="block">
                    <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-50 to-gray-100 p-4">
                      <Image
                        src={book.images && book.images[0] ? book.images[0] : '/placeholder.svg'}
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
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200 text-sm">
                        {book.title}
                      </h3>
                      <p className="text-xs text-gray-600 mb-2">by {book.author}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-emerald-600">${book.price.toFixed(2)}</span>
                        <span className="text-xs text-gray-500">Tax included</span>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div id="search-section">
        <SearchSection 
          categories={categories}
          onSearch={handleSearch}
          onCategoryChange={handleCategoryChange}
        />
      </div>
      
      {/* Full Book Grid with Search */}
      <div className="bg-white/50">
        <BookGrid 
          initialBooks={books} 
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
        />
      </div>
    </>
  );
} 