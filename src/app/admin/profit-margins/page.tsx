"use client";
import { useEffect, useState, useCallback } from "react";
import AdminNav from '@/components/AdminNav';
import { toast } from 'react-hot-toast';

interface Book {
  id: string;
  title: string;
  author: string;
  price: number;
  costPrice?: number;
  shippingCost?: number;
  stock: number;
  format?: string;
  categories: string[];
}

interface ProfitData {
  book: Book;
  profitMargin: number;
  profitAmount: number;
  profitPercentage: number;
  totalCost: number;
  shippingCost: number;
}

export default function ProfitMarginsPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [profitData, setProfitData] = useState<ProfitData[]>([]);
  const [filteredProfitData, setFilteredProfitData] = useState<ProfitData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingCost, setEditingCost] = useState<{ [key: string]: string }>({});
  const [searchQuery, setSearchQuery] = useState("");
  
    // Collapsible section states
  const [collapsedSections, setCollapsedSections] = useState({
    summary: false,
    topPerformers: false,
    categoryAnalysis: false,
    bulkShipping: false,
    actionItems: false,
    booksTable: false,
    legend: false
  });

  useEffect(() => {
    fetchBooks();
  }, []);

  useEffect(() => {
    if (books && Array.isArray(books)) {
      calculateProfitData();
    }
  }, [books]);

  // Initialize filtered data when profitData changes
  useEffect(() => {
    setFilteredProfitData(profitData);
  }, [profitData]);









  // Simple search handler - no complex logic
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (!value.trim()) {
      setFilteredProfitData(profitData);
    } else {
      const searchQuery = value.toLowerCase().trim();
      const filtered = profitData.filter(item => 
        item.book.title.toLowerCase().includes(searchQuery) ||
        item.book.author.toLowerCase().includes(searchQuery) ||
        item.book.categories.some(category => category.toLowerCase().includes(searchQuery)) ||
        (item.book.format && item.book.format.toLowerCase().includes(searchQuery))
      );
      
      setFilteredProfitData(filtered);
    }
  }, [profitData]);

  function toggleSection(section: keyof typeof collapsedSections) {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }

  function CollapsibleSection({ 
    title, 
    section, 
    children
  }: { 
    title: string; 
    section: keyof typeof collapsedSections; 
    children: React.ReactNode;
  }) {
    const isCollapsed = collapsedSections[section];
    
    return (
      <div className="mb-6">
        <button
          onClick={() => toggleSection(section)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {isCollapsed ? 'Click to expand' : 'Click to collapse'}
            </span>
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {!isCollapsed && (
          <div className="mt-4">
            {children}
          </div>
        )}
      </div>
    );
  }

  async function fetchBooks() {
    setLoading(true);
    try {
      const res = await fetch('/api/books');
      if (!res.ok) {
        throw new Error('Failed to fetch books');
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setBooks(data);
      } else {
        console.error('Unexpected data format:', data);
        setBooks([]);
        toast.error('Invalid data format received');
      }
    } catch (error) {
      console.error('Error fetching books:', error);
      toast.error('Failed to fetch books');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }

  function calculateProfitData() {
    if (!books || books.length === 0) {
      setProfitData([]);
      return;
    }

    const data: ProfitData[] = books.map(book => {
      const costPrice = book.costPrice || 0;
      const shippingCost = book.shippingCost || 0;
      const sellingPrice = book.price;
      const totalCost = costPrice + shippingCost;
      const profitAmount = sellingPrice - totalCost;
      const profitPercentage = totalCost > 0 ? (profitAmount / totalCost) * 100 : 0;
      const profitMargin = sellingPrice > 0 ? (profitAmount / sellingPrice) * 100 : 0;

      return {
        book,
        profitMargin,
        profitAmount,
        profitPercentage,
        totalCost,
        shippingCost,
      };
    });

    // Sort by profit margin descending
    data.sort((a, b) => b.profitMargin - a.profitMargin);
    setProfitData(data);
  }

  async function updateCostPrice(bookId: string, costPrice: number) {
    setSaving(bookId);
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costPrice }),
      });

      if (!res.ok) {
        throw new Error('Failed to update cost price');
      }

      // Update local state
      setBooks(prev => prev ? prev.map(book => 
        book.id === bookId ? { ...book, costPrice } : book
      ) : []);

      // Clear editing state
      setEditingCost(prev => {
        const newState = { ...prev };
        delete newState[bookId];
        return newState;
      });

      toast.success('Cost price updated successfully');
    } catch (error) {
      console.error('Error updating cost price:', error);
      toast.error('Failed to update cost price');
    } finally {
      setSaving(null);
    }
  }

  const handleCostPriceChange = useCallback((bookId: string, value: string) => {
    setEditingCost(prev => ({ ...prev, [bookId]: value }));
  }, []);

  const handleCostPriceSubmit = useCallback((bookId: string) => {
    const value = editingCost[bookId];
    if (value !== undefined) {
      const costPrice = parseFloat(value);
      if (!isNaN(costPrice) && costPrice >= 0) {
        updateCostPrice(bookId, costPrice);
      } else {
        toast.error('Please enter a valid cost price');
      }
    }
  }, [editingCost]);

  const handleCostPriceCancel = useCallback((bookId: string) => {
    setEditingCost(prev => {
      const newState = { ...prev };
      delete newState[bookId];
      return newState;
    });
  }, []);



  const totalBooks = books?.length || 0;
  const booksWithCostPrice = books?.filter(book => book.costPrice && book.costPrice > 0).length || 0;
  const averageProfitMargin = profitData?.length > 0 
    ? profitData.reduce((sum, item) => sum + item.profitMargin, 0) / profitData.length 
    : 0;

  // Additional analytics
  const totalInventoryValue = books?.reduce((sum, book) => sum + ((book.costPrice || 0) * book.stock), 0) || 0;
  const totalPotentialRevenue = books?.reduce((sum, book) => sum + (book.price * book.stock), 0) || 0;
  const totalPotentialProfit = totalPotentialRevenue - totalInventoryValue;
  const criticalStockBooks = books?.filter(book => book.stock === 1).length || 0;
  const outOfStockBooks = books?.filter(book => book.stock === 0).length || 0;
  const highMarginBooks = profitData?.filter(item => item.profitMargin > 20).length || 0;
  const lowMarginBooks = profitData?.filter(item => item.profitMargin >= 0 && item.profitMargin <= 10).length || 0;
  const losingBooks = profitData?.filter(item => item.profitMargin < 0).length || 0;
  
  // Top performers
  const topProfitableBooks = profitData?.slice(0, 5) || [];
  const worstPerformingBooks = profitData?.slice(-5).reverse() || [];
  
  // Category analysis
  const categoryAnalysis = books?.reduce((acc, book) => {
    book.categories.forEach((category: string) => {
      if (!acc[category]) {
        acc[category] = { count: 0, totalValue: 0, totalCost: 0 };
      }
      acc[category].count++;
      acc[category].totalValue += book.price * book.stock;
      acc[category].totalCost += (book.costPrice || 0) * book.stock;
    });
    return acc;
  }, {} as Record<string, { count: number; totalValue: number; totalCost: number }>) || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6" style={{ position: 'relative' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Profit Margin Analysis</h1>
            <div className="flex gap-2 mt-2 sm:mt-0">
              <button
                onClick={() => setCollapsedSections({
                  summary: false,
                  topPerformers: false,
                  categoryAnalysis: false,
                  bulkShipping: false,
                  actionItems: false,
                  booksTable: false,
                  legend: false
                })}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={() => setCollapsedSections({
                  summary: false,
                  topPerformers: true,
                  categoryAnalysis: true,
                  bulkShipping: true,
                  actionItems: true,
                  booksTable: true,
                  legend: true
                })}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>
          
          {/* Summary Cards */}
          <CollapsibleSection title="📊 Summary Dashboard" section="summary">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Row 1 - Basic Stats */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-1">Total Books</h3>
              <p className="text-2xl font-bold text-blue-900">{totalBooks}</p>
              <p className="text-xs text-blue-600 mt-1">
                In stock: {books?.filter(book => book.stock > 0).length || 0}
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-800 mb-1">Cost Data Coverage</h3>
              <p className="text-2xl font-bold text-green-900">
                {totalBooks > 0 ? Math.round((booksWithCostPrice / totalBooks) * 100) : 0}%
              </p>
              <p className="text-xs text-green-600 mt-1">
                {booksWithCostPrice} of {totalBooks} books
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-purple-800 mb-1">Avg. Profit Margin</h3>
              <p className="text-2xl font-bold text-purple-900">
                {averageProfitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-purple-600 mt-1">
                Across all books with cost data
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-orange-800 mb-1">Inventory Value</h3>
              <p className="text-2xl font-bold text-orange-900">
                ${totalInventoryValue.toLocaleString()}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Total cost basis
              </p>
            </div>

            {/* Row 2 - Financial Metrics */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-emerald-800 mb-1">Potential Revenue</h3>
              <p className="text-2xl font-bold text-emerald-900">
                ${totalPotentialRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                If all stock sold at current prices
              </p>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-teal-800 mb-1">Potential Profit</h3>
              <p className="text-2xl font-bold text-teal-900">
                ${totalPotentialProfit.toLocaleString()}
              </p>
              <p className="text-xs text-teal-600 mt-1">
                {totalPotentialRevenue > 0 ? ((totalPotentialProfit / totalPotentialRevenue) * 100).toFixed(1) : 0}% overall margin
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-800 mb-1">Critical Stock Alerts</h3>
              <p className="text-2xl font-bold text-red-900">{criticalStockBooks + outOfStockBooks}</p>
              <p className="text-xs text-red-600 mt-1">
                {outOfStockBooks} out of stock, {criticalStockBooks} only 1 left
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">Margin Distribution</h3>
              <div className="text-sm text-yellow-900">
                <p>High (&gt;20%): <span className="font-bold">{highMarginBooks}</span></p>
                <p>Low (0-10%): <span className="font-bold">{lowMarginBooks}</span></p>
                <p>Losses (&lt;0%): <span className="font-bold text-red-600">{losingBooks}</span></p>
              </div>
            </div>
            </div>
          </CollapsibleSection>

          {/* Top/Bottom Performers */}
          <CollapsibleSection title="🏆 Top & Bottom Performers" section="topPerformers">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Profitable Books */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-3">🏆 Top 5 Most Profitable</h3>
              <div className="space-y-2">
                {topProfitableBooks.length > 0 ? topProfitableBooks.map((item, index) => (
                  <div key={item.book.id} className="flex justify-between items-center bg-white p-2 rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{index + 1}. {item.book.title}</p>
                      <p className="text-xs text-gray-600">Stock: {item.book.stock}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{item.profitMargin.toFixed(1)}%</p>
                      <p className="text-xs text-gray-600">${item.profitAmount.toFixed(2)} profit</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-500 text-sm">No profitable books found</p>
                )}
              </div>
            </div>

            {/* Worst Performing Books */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-800 mb-3">⚠️ Lowest Margin Books</h3>
              <div className="space-y-2">
                {worstPerformingBooks.length > 0 ? worstPerformingBooks.map((item) => (
                  <div key={item.book.id} className="flex justify-between items-center bg-white p-2 rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{item.book.title}</p>
                      <p className="text-xs text-gray-600">Stock: {item.book.stock}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${item.profitMargin < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {item.profitMargin.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600">${item.profitAmount.toFixed(2)} profit</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-500 text-sm">No data available</p>
                )}
              </div>
            </div>
            </div>
          </CollapsibleSection>

          {/* Category Analysis */}
          {Object.keys(categoryAnalysis).length > 0 && (
            <CollapsibleSection title="📈 Category Performance Analysis" section="categoryAnalysis">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📊 Category Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(categoryAnalysis)
                  .sort(([,a], [,b]) => {
                    const aMargin = a.totalValue > 0 ? ((a.totalValue - a.totalCost) / a.totalValue) * 100 : 0;
                    const bMargin = b.totalValue > 0 ? ((b.totalValue - b.totalCost) / b.totalValue) * 100 : 0;
                    return bMargin - aMargin;
                  })
                  .map(([category, data]) => {
                    const margin = data.totalValue > 0 ? ((data.totalValue - data.totalCost) / data.totalValue) * 100 : 0;
                    const profit = data.totalValue - data.totalCost;
                    return (
                      <div key={category} className="bg-white p-3 rounded border">
                        <h4 className="font-medium text-gray-900 mb-2">{category}</h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-600">{data.count} books</p>
                          <p className="text-gray-600">Value: ${data.totalValue.toLocaleString()}</p>
                          <p className={`font-medium ${
                            margin > 20 ? 'text-green-600' : 
                            margin > 10 ? 'text-yellow-600' : 
                            margin > 0 ? 'text-orange-600' : 'text-red-600'
                          }`}>
                            {margin.toFixed(1)}% margin
                          </p>
                          <p className="text-xs text-gray-500">
                            ${profit.toLocaleString()} potential profit
                          </p>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </CollapsibleSection>
          )}

          {/* Bulk Shipping Cost Calculator */}
          <CollapsibleSection title="🚚 Bulk Shipping Cost Calculator" section="bulkShipping">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">🚚 Bulk Shipping Cost Calculator</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded border">
                <h4 className="font-medium text-gray-900 mb-2">Your Bulk Shipping Cost</h4>
                <p className="text-2xl font-bold text-indigo-600">$110</p>
                <p className="text-xs text-gray-600">Per bulk order</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <h4 className="font-medium text-gray-900 mb-2">Books with Shipping Data</h4>
                <p className="text-2xl font-bold text-indigo-600">
                  {books?.filter(book => book.shippingCost && book.shippingCost > 0).length || 0}
                </p>
                <p className="text-xs text-gray-600">
                  of {totalBooks} total books
                </p>
              </div>
              <div className="bg-white p-3 rounded border">
                <h4 className="font-medium text-gray-900 mb-2">Average Shipping Cost</h4>
                <p className="text-2xl font-bold text-indigo-600">
                  ${(() => {
                    const booksWithShipping = books?.filter(book => book.shippingCost && book.shippingCost > 0) || [];
                    if (booksWithShipping.length === 0) return '0.00';
                    const totalShipping = booksWithShipping.reduce((sum, book) => sum + (book.shippingCost || 0), 0);
                    return (totalShipping / booksWithShipping.length).toFixed(2);
                  })()}
                </p>
                <p className="text-xs text-gray-600">Per book (when set)</p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-indigo-100 rounded border border-indigo-300">
              <p className="text-sm text-indigo-800">
                <strong>💡 Tip:</strong> To get accurate profit margins, set shipping costs for your books. 
                You can estimate by dividing your $110 bulk shipping cost by the number of books you typically order together, 
                or set specific costs for heavy/large books that cost more to ship.
              </p>
            </div>
            </div>
          </CollapsibleSection>

          {/* Action Items */}
          <CollapsibleSection title="💡 Recommended Actions" section="actionItems">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">💡 Recommended Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {losingBooks > 0 && (
                <div className="bg-white p-3 rounded border-l-4 border-red-500">
                  <h4 className="font-medium text-red-700 mb-1">⚠️ Review Losing Books</h4>
                  <p className="text-gray-600">You have {losingBooks} books with negative margins. Consider repricing or reducing costs.</p>
                </div>
              )}
              {criticalStockBooks > 0 && (
                <div className="bg-white p-3 rounded border-l-4 border-orange-500">
                  <h4 className="font-medium text-orange-700 mb-1">📦 Critical Stock Alert</h4>
                  <p className="text-gray-600">{criticalStockBooks} books have only 1 copy left. Consider immediate restocking for high-margin items.</p>
                </div>
              )}
              {outOfStockBooks > 0 && (
                <div className="bg-white p-3 rounded border-l-4 border-red-500">
                  <h4 className="font-medium text-red-700 mb-1">❌ Out of Stock</h4>
                  <p className="text-gray-600">{outOfStockBooks} books are out of stock. Check if these are profitable to reorder.</p>
                </div>
              )}
              {(totalBooks - booksWithCostPrice) > 0 && (
                <div className="bg-white p-3 rounded border-l-4 border-yellow-500">
                  <h4 className="font-medium text-yellow-700 mb-1">📝 Missing Cost Data</h4>
                  <p className="text-gray-600">{totalBooks - booksWithCostPrice} books need cost prices for accurate profit tracking.</p>
                </div>
              )}
              {highMarginBooks > 0 && (
                <div className="bg-white p-3 rounded border-l-4 border-green-500">
                  <h4 className="font-medium text-green-700 mb-1">🎯 Focus on Winners</h4>
                  <p className="text-gray-600">{highMarginBooks} books have excellent margins. Consider promoting these more.</p>
                </div>
              )}
              <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                <h4 className="font-medium text-blue-700 mb-1">📈 Optimize Pricing</h4>
                <p className="text-gray-600">Review books with 0-10% margins. Small price increases could significantly improve profitability.</p>
              </div>
            </div>
            </div>
          </CollapsibleSection>

          {/* Search Bar and Books Table */}
          <CollapsibleSection title="📚 Books Profit Analysis Table" section="booksTable">
            {/* Search Bar */}
            <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
              <div className="flex-1 max-w-lg">
                <label htmlFor="search" className="block text-sm font-semibold text-gray-800 mb-3">
                  🔍 Search Books
                </label>
                <div className="relative">
                  <input
                    id="search"
                    type="text"
                    placeholder="Type to search by title, author, category, or format..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchQuery("");
                        setFilteredProfitData(profitData);
                      }
                    }}
                    className="w-full px-6 py-4 pl-12 pr-12 border-2 border-gray-200 rounded-xl text-base text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 font-medium shadow-sm hover:border-gray-300 transition-all duration-200"
                    autoComplete="off"
                  />
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {searchQuery && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setSearchQuery("");
                        setFilteredProfitData(profitData);
                      }}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center group"
                      title="Clear search (Esc)"
                    >
                      <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                        <svg className="h-5 w-5 text-gray-500 group-hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 px-4 py-3 rounded-lg border">
                {searchQuery ? (
                  <span className="font-medium">
                    📚 Showing <span className="text-blue-600">{filteredProfitData.length}</span> of <span className="text-gray-800">{profitData.length}</span> books
                  </span>
                ) : (
                  <span className="font-medium">
                    📚 <span className="text-gray-800">{profitData.length}</span> books total
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Books Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-8">Loading books...</div>
            ) : !books || books.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No books found</div>
            ) : filteredProfitData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No books match your search criteria' : 'No profit data available'}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Book Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shipping Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Selling Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit Margin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Return on Investment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Potential Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProfitData && filteredProfitData.length > 0 && filteredProfitData.map((item) => (
                    <tr key={item.book.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.book.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            by {item.book.author}
                            {item.book.format && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {item.book.format}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingCost[item.book.id] !== undefined ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={editingCost[item.book.id]}
                              onChange={(e) => handleCostPriceChange(item.book.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCostPriceSubmit(item.book.id);
                                } else if (e.key === 'Escape') {
                                  handleCostPriceCancel(item.book.id);
                                }
                              }}
                              className="w-24 px-3 py-2 border-2 border-blue-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                              autoFocus
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleCostPriceSubmit(item.book.id)}
                                disabled={saving === item.book.id}
                                className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                                title="Save (Enter)"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => handleCostPriceCancel(item.book.id)}
                                className="px-3 py-2 bg-gray-500 text-white text-xs rounded-lg hover:bg-gray-600 font-medium"
                                title="Cancel (Esc)"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-900 font-medium">
                              {item.book.costPrice ? `$${item.book.costPrice.toFixed(2)}` : 'Not set'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setEditingCost(prev => ({ 
                                  ...prev, 
                                  [item.book.id]: item.book.costPrice?.toString() || '0' 
                                }));
                              }}
                              className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg hover:bg-blue-200 font-medium transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                        {/* Shipping Cost Display */}
                        <div className="text-xs text-gray-500 mt-2">
                          Shipping: {item.book.shippingCost ? `$${item.book.shippingCost.toFixed(2)}` : 'Not set'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.book.shippingCost ? `$${item.book.shippingCost.toFixed(2)}` : 'Not set'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${item.totalCost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${item.book.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          item.profitAmount > 0 ? 'text-green-600' : 
                          item.profitAmount < 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          ${item.profitAmount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${
                            item.profitMargin > 20 ? 'text-green-600' : 
                            item.profitMargin > 10 ? 'text-yellow-600' : 
                            item.profitMargin > 0 ? 'text-orange-600' : 'text-red-600'
                          }`}>
                            {item.profitMargin.toFixed(1)}%
                          </span>
                          <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                item.profitMargin > 20 ? 'bg-green-500' : 
                                item.profitMargin > 10 ? 'bg-yellow-500' : 
                                item.profitMargin > 0 ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(Math.max(item.profitMargin, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm ${
                          item.profitPercentage > 0 ? 'text-green-600' : 
                          item.profitPercentage < 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {item.book.costPrice && item.book.costPrice > 0 
                            ? `${item.profitPercentage.toFixed(1)}%` 
                            : 'N/A'
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.book.stock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          item.profitAmount * item.book.stock > 0 ? 'text-green-600' : 
                          item.profitAmount * item.book.stock < 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          ${(item.profitAmount * item.book.stock).toFixed(2)}
                        </span>
                        <p className="text-xs text-gray-500">
                          if all stock sold
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          </CollapsibleSection>

          {/* Legend */}
          <CollapsibleSection title="📖 Profit Margin Legend & Formulas" section="legend">
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Profit Margin Legend:</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded mr-2 shadow-sm"></div>
                <span className="font-medium text-gray-800">Excellent (&gt;20%)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-500 rounded mr-2 shadow-sm"></div>
                <span className="font-medium text-gray-800">Good (10-20%)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-orange-500 rounded mr-2 shadow-sm"></div>
                <span className="font-medium text-gray-800">Fair (0-10%)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 rounded mr-2 shadow-sm"></div>
                <span className="font-medium text-gray-800">Loss (&lt;0%)</span>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-700 bg-white p-3 rounded border border-gray-200">
              <div className="font-semibold text-gray-800 mb-1">Calculation Formulas:</div>
              <div className="space-y-1">
                <p><strong className="text-gray-800">Profit Margin:</strong> <span className="text-gray-700">(Selling Price - Cost Price) ÷ Selling Price × 100</span></p>
                <p><strong className="text-gray-800">Return on Investment:</strong> <span className="text-gray-700">(Selling Price - Cost Price) ÷ Cost Price × 100</span></p>
              </div>
            </div>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}

