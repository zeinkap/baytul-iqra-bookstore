'use client';

import { useState } from 'react';

interface SearchSectionProps {
  categories: string[];
  onSearch?: (query: string) => void;
  onCategoryChange?: (categories: string[]) => void;
}

export default function SearchSection({
  categories,
  onSearch,
  onCategoryChange
}: SearchSectionProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCategory = (category: string) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    
    setSelectedCategories(newCategories);
    onCategoryChange?.(newCategories);
  };

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
    <div className="max-w-7xl mx-auto px-4 mb-16">
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl p-8 lg:p-12 border border-white/50">
        <div className="text-center mb-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Discover Your Next Read
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Search through our extensive collection of Islamic literature. Filter by category, author, or browse our curated selections.
          </p>
        </div>
        
        {/* Quick Search Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by title, author, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
            />
            <button 
              onClick={handleSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded-xl hover:shadow-lg transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Category Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {categories.slice(0, 8).map((category) => {
            const isSelected = selectedCategories.includes(category);
            return (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
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
            className="px-4 py-2 bg-gray-50 text-gray-700 rounded-full text-sm font-medium border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
          >
            Clear All
          </button>
        </div>


      </div>
    </div>
  );
} 