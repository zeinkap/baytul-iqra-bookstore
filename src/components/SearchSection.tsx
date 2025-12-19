'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchSectionProps {
  categories: string[];
  onSearch?: (query: string) => void;
  onCategoryChange?: (categories: string[]) => void;
  onPriceRangeChange?: (priceRange: string | null) => void;
}

export default function SearchSection({
  categories,
  onSearch,
  onCategoryChange,
  onPriceRangeChange,
  initialSelectedCategories = []
}: SearchSectionProps & { initialSelectedCategories?: string[] }) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialSelectedCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with parent when initialSelectedCategories changes
  useEffect(() => {
    setSelectedCategories(initialSelectedCategories);
  }, [initialSelectedCategories]);

  const toggleCategory = (category: string) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    
    setSelectedCategories(newCategories);
    onCategoryChange?.(newCategories);
  };

  // Real-time search with debouncing
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      onSearch?.(searchQuery);
      // Scroll to book grid after search (only if there's a query)
      if (searchQuery.trim()) {
        setTimeout(() => {
          const bookGrid = document.getElementById('book-grid');
          if (bookGrid) {
            bookGrid.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          }
        }, 100);
      }
    }, 400); // 400ms delay for better UX

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, onSearch]);

  const handleSearch = () => {
    onSearch?.(searchQuery);
    // Scroll to book grid after search
    setTimeout(() => {
      const bookGrid = document.getElementById('book-grid');
      if (bookGrid) {
        bookGrid.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 100); // Small delay to ensure the search results have updated
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-12 sm:mb-16">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 lg:p-12 border border-white/50">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">
            Discover Your Next Read
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-2xl mx-auto">
            Search through our extensive collection of Islamic literature. Filter by category, author, or browse our curated selections.
          </p>
        </div>
        
        {/* Quick Search Bar */}
        <div className="max-w-4xl mx-auto mb-6 sm:mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by title, author, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
              data-testid="search-input"
            />
            <button 
              onClick={handleSearch}
              className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-2.5 sm:p-3 rounded-lg sm:rounded-xl hover:shadow-lg active:scale-95 transition-all duration-200 touch-manipulation"
              aria-label="Search"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Price Range Quick Filters */}
        <div className="mb-6 sm:mb-8">
          <div className="text-center mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Filter by Price</h3>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {[
                { label: 'Under $10', value: 'under-10' },
                { label: '$10 - $25', value: '10-25' },
                { label: '$25 - $50', value: '25-50' },
                { label: '$50+', value: '50-plus' },
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => {
                    const newRange = selectedPriceRange === range.value ? null : range.value;
                    setSelectedPriceRange(newRange);
                    onPriceRangeChange?.(newRange);
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium border transition-all duration-200 active:scale-95 touch-manipulation ${
                    selectedPriceRange === range.value
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 hover:border-gray-400'
                  }`}
                >
                  {range.label}
                </button>
              ))}
              {selectedPriceRange && (
                <button
                  onClick={() => {
                    setSelectedPriceRange(null);
                    onPriceRangeChange?.(null);
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 text-gray-700 rounded-full text-xs sm:text-sm font-medium border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 active:scale-95 touch-manipulation"
                >
                  Clear Price
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Category Filters */}
        <div className="mb-6 sm:mb-8">
          {/* Desktop: Button layout */}
          <div className="hidden md:flex flex-wrap justify-center gap-3">
            {categories.map((category) => {
              const isSelected = selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 active:scale-95 touch-manipulation ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 hover:border-gray-400'
                  }`}
                >
                  {category}
                </button>
              );
            })}
            <button 
              onClick={() => {
                setSelectedCategories([]);
                setSearchQuery('');
                onCategoryChange?.([]);
                onSearch?.('');
              }}
              className="px-4 py-2 bg-gray-50 text-gray-700 rounded-full text-sm font-medium border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 active:scale-95 touch-manipulation"
            >
              Clear All
            </button>
          </div>

          {/* Mobile: Scrollable chip layout */}
          <div className="md:hidden">
            <div className="text-center mb-3 sm:mb-4">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3 sm:mb-4">Select Categories</h3>
              
              {/* Scrollable category container */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 max-h-64 sm:max-h-72 overflow-y-auto">
                <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                  {categories.map((category) => {
                    const isSelected = selectedCategories.includes(category);
                    return (
                      <button
                        key={category}
                        onClick={() => toggleCategory(category)}
                        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium border transition-all duration-200 active:scale-95 touch-manipulation min-h-[44px] flex items-center justify-center ${
                          isSelected
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:border-gray-400'
                        }`}
                        data-testid={`category-chip-${category.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Clear All button */}
              {selectedCategories.length > 0 && (
                <button 
                  onClick={() => {
                    setSelectedCategories([]);
                    setSearchQuery('');
                    onCategoryChange?.([]);
                    onSearch?.('');
                  }}
                  className="mt-3 px-4 py-2 bg-gray-50 text-gray-700 rounded-full text-xs sm:text-sm font-medium border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 active:scale-95 touch-manipulation"
                  data-testid="clear-all-categories"
                >
                  Clear All Categories
                </button>
              )}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
} 