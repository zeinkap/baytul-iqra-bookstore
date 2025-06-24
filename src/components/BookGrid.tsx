"use client";
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AddToCartButtonClient from '@/components/AddToCartButtonClient';
import SearchBar from '@/components/SearchBar';

export type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  categories: string[];
  createdAt: string;
  updatedAt: string;
};

interface BookGridProps {
  initialBooks: Book[];
  categories: string[];
}

export default function BookGrid({ initialBooks, categories }: BookGridProps) {
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleCategoryFilter = useCallback(async (category: string) => {
    setLoading(true);
    setSelectedCategory(category);
    setSearchQuery(''); // Clear search when filtering by category
    
    try {
      const response = await fetch(`/api/books/category/${encodeURIComponent(category)}`);
      if (response.ok) {
        const categoryBooks = await response.json();
        setBooks(categoryBooks);
      } else {
        console.error('Category filter failed');
        setBooks(initialBooks);
      }
    } catch (error) {
      console.error('Category filter error:', error);
      setBooks(initialBooks);
    } finally {
      setLoading(false);
    }
  }, [initialBooks]);

  // Check for category parameter in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    if (categoryParam) {
      handleCategoryFilter(categoryParam);
    }
  }, [handleCategoryFilter]);

  const handleSearch = async (query: string) => {
    setLoading(true);
    setSearchQuery(query);
    setSelectedCategory(null); // Clear category filter when searching
    
    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const searchResults = await response.json();
        setBooks(searchResults);
      } else {
        console.error('Search failed');
        setBooks(initialBooks);
      }
    } catch (error) {
      console.error('Search error:', error);
      setBooks(initialBooks);
    } finally {
      setLoading(false);
    }
  };

  // Combined filter: if both search and category are set, filter client-side
  const displayedBooks = books.filter((book) => {
    const matchesSearch =
      !searchQuery ||
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory ||
      book.categories.map((c) => c.toLowerCase()).includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const clearFilters = () => {
    setBooks(initialBooks);
    setSearchQuery('');
    setSelectedCategory(null);
    // Update URL to remove category parameter
    const url = new URL(window.location.href);
    url.searchParams.delete('category');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="py-16">
      {/* Search Section */}
      <div className="max-w-6xl mx-auto px-4 mb-12">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/50">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Discover Your Next Read</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Search through our carefully curated collection of Islamic literature</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-center mb-6">
            <SearchBar 
              onSearch={handleSearch}
              placeholder="Search by title or author..."
              className="max-w-xl w-full md:w-96"
            />
            <select
              value={selectedCategory || ''}
              onChange={e => {
                const val = e.target.value;
                if (val) handleCategoryFilter(val);
                else clearFilters();
              }}
              className="w-full md:w-64 border-2 border-gray-200 rounded-lg py-3 px-4 text-base font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm hover:border-gray-300 transition-colors duration-200"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          {(searchQuery || selectedCategory) && (
            <div className="text-center mt-4">
              {loading ? (
                <div className="inline-flex items-center gap-3 bg-blue-50 text-blue-700 px-4 py-2 rounded-full">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-medium">Loading...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">
                      {searchQuery 
                        ? `Found ${displayedBooks.length} book${displayedBooks.length !== 1 ? 's' : ''} for "${searchQuery}"`
                        : `${displayedBooks.length} book${displayedBooks.length !== 1 ? 's' : ''} in ${selectedCategory}`
                      }
                    </span>
                  </div>
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear Filter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Show total number of books when All Categories is selected */}
      {(!selectedCategory || selectedCategory === '') && !searchQuery && (
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
          {displayedBooks.length === 0 && !loading && (
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
          {books.map((book, idx) => (
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
                      src={book.images && book.images[0] ? book.images[0] : '/placeholder.svg'}
                      alt={book.title}
                      fill
                      className={`object-contain drop-shadow-lg transition-opacity duration-500 ${hoveredIndex === idx && book.images && book.images[1] ? 'opacity-0' : 'opacity-100'}`}
                      sizes="(max-width: 768px) 50vw, 25vw"
                      priority={false}
                    />
                    {/* Second image (on hover, if exists) */}
                    {book.images && book.images[1] && (
                      <Image
                        src={book.images[1]}
                        alt={book.title + ' alternate'}
                        fill
                        className={`object-contain drop-shadow-lg absolute inset-0 transition-opacity duration-500 ${hoveredIndex === idx ? 'opacity-100' : 'opacity-0'}`}
                        sizes="(max-width: 768px) 50vw, 25vw"
                        priority={false}
                      />
                    )}
                    {/* Stock indicator */}
                    <div className="absolute top-3 right-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-semibold ${book.stock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {book.stock > 0 ? 'In Stock' : 'Out of Stock'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Book Details */}
                  <div className="p-6 pb-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200">
                      {book.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">by {book.author}</p>
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
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-emerald-600">${book.price.toFixed(2)}</span>
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
                      <AddToCartButtonClient id={book.id} title={book.title} price={book.price} image={book.images && book.images[0] ? book.images[0] : ''} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 