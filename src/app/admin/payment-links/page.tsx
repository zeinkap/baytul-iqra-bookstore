"use client";
import { useEffect, useState, useMemo } from "react";
import { toast } from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';

// Debounce utility function for string parameters
function debounce(func: (query: string) => void, wait: number): (query: string) => void {
  let timeout: NodeJS.Timeout;
  return (query: string) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(query), wait);
  };
}

interface PaymentLink {
  id: string;
  url: string;
  active: boolean;
  created: number;
  metadata?: {
    orderId?: string;
    fulfillmentType?: string;
    pickupLocation?: string;
    customerEmail?: string;
    customerPhone?: string;
    cartItems?: string;
    itemCount?: string | number;
    totalItems?: string | number;
  };
}

interface CartItem {
  title: string;
  price: number;
  quantity: number;
  image?: string;
  bookId?: string;
}

interface Book {
  id: string;
  title: string;
  price: number;
  author: string;
  images: string[];
}

export default function AdminPaymentLinksPage() {
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suggestions, setSuggestions] = useState<Book[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<PaymentLink | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [form, setForm] = useState({
    items: [{ title: '', price: 0, quantity: 1 }] as CartItem[],
    fulfillmentType: 'pickup' as 'shipping' | 'pickup',
    pickupLocation: 'Alpharetta, GA',
    customerEmail: '',
    customerPhone: '',
  });

  useEffect(() => {
    fetchPaymentLinks();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (!target.closest('.autocomplete-container')) {
        setShowSuggestions(null);
        setSuggestions([]);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchPaymentLinks() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payment-links');
      if (!res.ok) {
        throw new Error('Failed to fetch payment links');
      }
      const data = await res.json() as PaymentLink[];
      setPaymentLinks(data);
    } catch (error) {
      console.error('Error fetching payment links:', error);
      toast.error('Failed to fetch payment links');
    } finally {
      setLoading(false);
    }
  }

  async function createPaymentLink() {
    setCreating(true);
    try {
      const orderId = `order_${Date.now()}`;
      
      const res = await fetch('/api/checkout_sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: form.items,
          fulfillmentType: form.fulfillmentType,
          orderId,
          email: form.customerEmail,
          phone: form.customerPhone,
          createPaymentLink: true,
          pickupLocation: form.pickupLocation,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create payment link');
      }

      toast.success('Payment link created successfully!');
      setForm({
        items: [{ title: '', price: 0, quantity: 1 }],
        fulfillmentType: 'pickup',
        pickupLocation: 'Alpharetta, GA',
        customerEmail: '',
        customerPhone: '',
      });
      
      // Refresh the list
      await fetchPaymentLinks();
    } catch (error) {
      console.error('Error creating payment link:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create payment link');
    } finally {
      setCreating(false);
    }
  }

  function addItem() {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { title: '', price: 0, quantity: 1 }]
    }));
  }

  function removeItem(index: number) {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  }

  // Debounced search function - use useMemo to create it once
  const debouncedSearch = useMemo(
    () => debounce(async (query: string) => {
      if (!query || query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}&limit=5`);
        if (res.ok) {
          const books = await res.json();
          setSuggestions(books);
        }
      } catch (error) {
        console.error('Error searching books:', error);
      }
    }, 300),
    [] // Empty dependency array - create once
  );

  function searchBooks(query: string) {
    debouncedSearch(query);
  }

  function updateItem(index: number, field: keyof CartItem, value: string | number) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));

    // If updating title, search for suggestions
    if (field === 'title' && typeof value === 'string') {
      searchBooks(value);
      setShowSuggestions(index);
    }
  }

  function selectBook(index: number, book: Book) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { 
          ...item, 
          title: book.title, 
          price: book.price,
          bookId: book.id,
          image: book.images && book.images.length > 0 ? book.images[0] : undefined
        } : item
      )
    }));
    setSuggestions([]);
    setShowSuggestions(null);
  }

  function copyToClipboard(url: string) {
    navigator.clipboard.writeText(url);
    toast.success('Payment link copied to clipboard!');
  }

  function promptDeleteLink(link: PaymentLink) {
    setLinkToDelete(link);
    setShowDeleteConfirm(true);
  }

  function cancelDelete() {
    setLinkToDelete(null);
    setShowDeleteConfirm(false);
  }

  async function confirmDelete() {
    if (!linkToDelete) return;

    setDeleting(linkToDelete.id);
    setShowDeleteConfirm(false);
    
    try {
      // First deactivate in Stripe
      const deactivateRes = await fetch(`/api/admin/payment-links/${linkToDelete.id}`, {
        method: 'DELETE',
      });

      const deactivateData = await deactivateRes.json();

      if (!deactivateRes.ok) {
        throw new Error(deactivateData.error || 'Failed to deactivate payment link');
      }

      // Then hide it from the admin panel
      const hideRes = await fetch('/api/admin/payment-links/hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentLinkId: linkToDelete.id }),
      });

      const hideData = await hideRes.json();

      if (!hideRes.ok) {
        throw new Error(hideData.error || 'Failed to hide payment link');
      }

      toast.success('Payment link deleted successfully!');
      
      // Refresh the payment links list
      await fetchPaymentLinks();
      setLinkToDelete(null);
    } catch (error) {
      console.error('Error deleting payment link:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete payment link');
    } finally {
      setDeleting(null);
    }
  }

  function promptDeleteAll() {
    setShowDeleteAllConfirm(true);
  }

  function cancelDeleteAll() {
    setShowDeleteAllConfirm(false);
  }

  async function confirmDeleteAll() {
    setDeletingAll(true);
    setShowDeleteAllConfirm(false);

    let successCount = 0;
    let failCount = 0;

    try {
      // Delete all payment links
      for (const link of paymentLinks) {
        try {
          // Deactivate in Stripe
          const deactivateRes = await fetch(`/api/admin/payment-links/${link.id}`, {
            method: 'DELETE',
          });

          if (!deactivateRes.ok) {
            throw new Error('Failed to deactivate');
          }

          // Hide from admin panel
          const hideRes = await fetch('/api/admin/payment-links/hidden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentLinkId: link.id }),
          });

          if (!hideRes.ok) {
            throw new Error('Failed to hide');
          }

          successCount++;
        } catch (error) {
          console.error(`Error deleting payment link ${link.id}:`, error);
          failCount++;
        }
      }

      // Show result
      if (failCount === 0) {
        toast.success(`Successfully deleted all ${successCount} payment links!`);
      } else {
        toast.success(`Deleted ${successCount} payment links. ${failCount} failed.`);
      }

      // Refresh the payment links list
      await fetchPaymentLinks();
    } catch (error) {
      console.error('Error in delete all operation:', error);
      toast.error('Failed to delete all payment links');
    } finally {
      setDeletingAll(false);
    }
  }

  function formatDate(timestamp: number | null, orderId?: string) {
    // If no timestamp is available, try to extract date from orderId
    if (!timestamp) {
      if (orderId && orderId.startsWith('order_')) {
        // Extract timestamp from orderId format: order_1755203086847
        const timestampStr = orderId.replace('order_', '');
        const timestampNum = parseInt(timestampStr);
        if (!isNaN(timestampNum)) {
          return new Date(timestampNum).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        }
      }
      return 'Date unavailable';
    }
    
    // Handle different timestamp formats
    let date: Date;
    
    if (typeof timestamp === 'string') {
      // If it's a string, try to parse it
      date = new Date(timestamp);
    } else if (timestamp > 1000000000000) {
      // If it's a large number, it's likely milliseconds
      date = new Date(timestamp);
    } else {
      // If it's a smaller number, it's likely seconds
      date = new Date(timestamp * 1000);
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Date unavailable';
    }
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function parseCartItems(metadata?: PaymentLink['metadata']): CartItem[] {
    if (!metadata) return [];
    
    // Try to parse cartItems JSON if available
    if (metadata.cartItems) {
      try {
        const items = JSON.parse(metadata.cartItems);
        return Array.isArray(items) ? items : [];
      } catch (error) {
        console.error('Error parsing cart items:', error);
      }
    }
    
    // Fallback: handle legacy format with bookIds and quantities (no titles available)
    // This is for old payment links created before the cartItems field was added
    return [];
  }

  function getItemsDisplay(link: PaymentLink): { hasItems: boolean; itemCount: number; totalQuantity: number } {
    const items = parseCartItems(link.metadata);
    
    if (items.length > 0) {
      return {
        hasItems: true,
        itemCount: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0)
      };
    }
    
    // Fallback to metadata counts
    return {
      hasItems: false,
      itemCount: link.metadata?.itemCount ? parseInt(link.metadata.itemCount as string) : 0,
      totalQuantity: link.metadata?.totalItems ? parseInt(link.metadata.totalItems as string) : 0
    };
  }

  function getTotalAmount(link: PaymentLink): number {
    const items = parseCartItems(link.metadata);
    if (items.length > 0) {
      return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }
    return 0;
  }

  // Filter and sort payment links
  const filteredAndSortedLinks = useMemo(() => {
    let filtered = paymentLinks;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(link => {
        const items = parseCartItems(link.metadata);
        const searchableText = [
          link.metadata?.orderId,
          link.metadata?.customerEmail,
          link.metadata?.customerPhone,
          link.url,
          ...items.map(item => item.title)
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(query);
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = (a.created || 0) - (b.created || 0);
          break;
        case 'status':
          comparison = a.active === b.active ? 0 : a.active ? 1 : -1;
          break;
        case 'total':
          comparison = getTotalAmount(a) - getTotalAmount(b);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [paymentLinks, searchQuery, sortBy, sortOrder]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Payment Links Management</h1>
        
        {/* Create Payment Link Form */}
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Payment Link</h2>
          
          {/* Items */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Items <span className="text-red-500">*</span>
            </label>
            {form.items.map((item, index) => (
              <div key={index} className="space-y-2 mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="relative autocomplete-container md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Item Title <span className="text-red-500">*</span>
                      {item.image && (
                        <span className="ml-2 text-xs text-green-600 font-normal">
                          ✓ Image attached
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Start typing to search books..."
                        value={item.title}
                        onChange={(e) => updateItem(index, 'title', e.target.value)}
                        onFocus={() => {
                          if (item.title.trim().length >= 2) {
                            searchBooks(item.title);
                            setShowSuggestions(index);
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                      />
                      {item.image && (
                        <img 
                          src={item.image} 
                          alt={item.title}
                          className="w-12 h-12 object-cover rounded border border-gray-300 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    
                    {/* Autocomplete Suggestions */}
                    {showSuggestions === index && suggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {suggestions.map((book) => (
                          <button
                            key={book.id}
                            onClick={() => selectBook(index, book)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                          >
                            {book.images && book.images.length > 0 && (
                              <img 
                                src={book.images[0]} 
                                alt={book.title}
                                className="w-10 h-10 object-cover rounded border border-gray-200"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{book.title}</div>
                              <div className="text-sm text-gray-600">
                                by {book.author} • ${book.price.toFixed(2)}
                                {book.images && book.images.length > 0 && (
                                  <span className="ml-2 text-green-600">📷</span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Price ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="1"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => removeItem(index)}
                      className="w-full px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                    >
                      Remove Item
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addItem}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              + Add Another Item
            </button>
          </div>

          {/* Fulfillment Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fulfillment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.fulfillmentType}
              onChange={(e) => setForm(prev => ({ ...prev, fulfillmentType: e.target.value as 'shipping' | 'pickup' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="pickup">Local Pickup</option>
              <option value="shipping">Shipping</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose how the customer will receive their order
            </p>
          </div>

          {/* Pickup Location */}
          {form.fulfillmentType === 'pickup' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pickup Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Alpharetta, GA"
                value={form.pickupLocation}
                onChange={(e) => setForm(prev => ({ ...prev, pickupLocation: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Where customers can pick up their order
              </p>
            </div>
          )}

          {/* Customer Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Email <span className="text-gray-400">(Optional)</span>
            </label>
            <input
              type="email"
              placeholder="customer@example.com"
              value={form.customerEmail}
              onChange={(e) => setForm(prev => ({ ...prev, customerEmail: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Customer&apos;s email for order confirmation (optional)
            </p>
          </div>

          {/* Customer Phone */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Phone <span className="text-gray-400">(Optional)</span>
            </label>
            <input
              type="tel"
              placeholder="e.g., 123-456-7890"
              value={form.customerPhone}
              onChange={(e) => setForm(prev => ({ ...prev, customerPhone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Customer&apos;s phone number for order updates (optional)
            </p>
          </div>

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="text-red-500">*</span> Required fields must be filled to create a payment link.
            </p>
          </div>

          <button
            onClick={createPaymentLink}
            disabled={creating || form.items.some(item => !item.title || item.price <= 0)}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {creating ? 'Creating Payment Link...' : 'Create Payment Link'}
          </button>
        </div>

        {/* Payment Links List */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Payment Links</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Search */}
              <input
                type="text"
                placeholder="Search by order ID, email, phone, or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder-gray-500 bg-white"
              />
              {/* Sort */}
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'status' | 'total')}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                >
                  <option value="date">Sort by Date</option>
                  <option value="status">Sort by Status</option>
                  <option value="total">Sort by Total</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm text-gray-700 bg-white"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 mb-4">
            {filteredAndSortedLinks.length} of {paymentLinks.length} payment link{paymentLinks.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading payment links...</p>
            </div>
          ) : filteredAndSortedLinks.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500 text-lg mb-2">
                {searchQuery ? 'No payment links found matching your search' : 'No payment links found'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-blue-600 hover:text-blue-700 text-sm underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedLinks.map((link) => {
                const totalAmount = getTotalAmount(link);
                return (
                <div key={link.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700">
                          Payment Link Details
                        </p>
                        {totalAmount > 0 && (
                          <p className="text-lg font-bold text-emerald-600">
                            ${totalAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Created:</span> {formatDate(link.created, link.metadata?.orderId)}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Status:</span> 
                        <span className={`ml-1 px-2 py-1 rounded-full text-xs font-medium ${
                          link.active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {link.active ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                      {link.metadata?.orderId && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Order ID:</span> {link.metadata.orderId}
                        </p>
                      )}
                      {link.metadata?.fulfillmentType && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Fulfillment:</span> 
                          <span className="ml-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {link.metadata.fulfillmentType === 'pickup' ? 'Local Pickup' : 'Shipping'}
                          </span>
                        </p>
                      )}
                      {link.metadata?.customerEmail && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Email:</span> {link.metadata.customerEmail}
                        </p>
                      )}
                      {link.metadata?.customerPhone && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Phone:</span> {link.metadata.customerPhone}
                        </p>
                      )}
                      
                      {/* Cart Items with Quantities */}
                      {(() => {
                        const items = parseCartItems(link.metadata);
                        const display = getItemsDisplay(link);
                        
                        if (display.hasItems && items.length > 0) {
                          return (
                            <div className="mt-3 border-t border-gray-200 pt-3">
                              <p className="text-sm font-semibold text-gray-800 mb-2">📦 Order Items:</p>
                              <div className="space-y-1">
                                {items.map((item, index) => (
                                  <div key={index} className="text-sm text-gray-700 flex justify-between items-center bg-blue-50 px-3 py-2 rounded border border-blue-100">
                                    <span className="truncate flex-1 font-medium">{item.title}</span>
                                    <span className="text-gray-600 ml-2 whitespace-nowrap">
                                      Qty: {item.quantity} × ${item.price.toFixed(2)} = ${(item.price * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {/* Summary */}
                              <div className="mt-3 pt-2 border-t border-gray-300 bg-emerald-50 px-3 py-2 rounded">
                                <div className="flex justify-between text-sm font-semibold text-gray-800">
                                  <span>Total Items: {display.itemCount}</span>
                                  <span>Total Quantity: {display.totalQuantity}</span>
                                  <span className="text-emerald-700">Total: ${items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        } else if (display.itemCount > 0) {
                          // Show basic count for legacy links
                          return (
                            <div className="mt-3 border-t border-gray-200 pt-3">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Items:</span> {display.itemCount} item(s), {display.totalQuantity} total quantity
                                <span className="text-xs text-gray-500 ml-2">(Legacy format - details not available)</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 transition-colors font-medium flex items-center gap-2"
                        title="Open payment link in new tab"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open Link
                      </button>
                      <button
                        onClick={() => copyToClipboard(link.url)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                        title="Copy payment link to clipboard"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Link
                      </button>
                      <button
                        onClick={() => promptDeleteLink(link)}
                        disabled={deleting === link.id}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {deleting === link.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-sm font-mono break-all text-gray-900 border border-gray-300 shadow-inner">
                    {link.url}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* Hidden Payment Links Management */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Hidden Payment Links</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/admin/payment-links/hidden');
                    if (res.ok) {
                      const hiddenLinks = await res.json();
                      if (hiddenLinks.length > 0) {
                        alert(`You have ${hiddenLinks.length} hidden payment link(s).\n\nTo restore them, you can manually edit the data/hidden-payment-links.json file or contact support.`);
                      } else {
                        alert('No hidden payment links found.');
                      }
                    }
                  } catch {
                    toast.error('Failed to check hidden payment links');
                  }
                }}
                className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors font-medium"
              >
                Check Hidden Links
              </button>
              
              {paymentLinks.length > 0 && (
                <button
                  onClick={promptDeleteAll}
                  disabled={deletingAll}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {deletingAll ? 'Deleting All...' : `Delete All (${paymentLinks.length})`}
                </button>
              )}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">
              Hidden payment links are removed from this list but still exist in your Stripe dashboard.
            </p>
            <p className="text-sm text-gray-600">
              To restore hidden links, you can manually edit the <code className="bg-gray-200 px-1 rounded">data/hidden-payment-links.json</code> file.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {linkToDelete && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          title="Delete Payment Link"
          message="Are you sure you want to delete this payment link? It will be deactivated in Stripe and removed from this admin panel."
          confirmText="Delete"
          variant="danger"
          loading={deleting === linkToDelete.id}
        >
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-900 break-all">
                {linkToDelete.url}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                <span>Created: {formatDate(linkToDelete.created, linkToDelete.metadata?.orderId)}</span>
                <span>•</span>
                <span className={linkToDelete.active ? 'text-emerald-600' : 'text-red-600'}>
                  {linkToDelete.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </ConfirmDialog>
      )}

      {/* Delete All Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteAllConfirm}
        onClose={cancelDeleteAll}
        onConfirm={confirmDeleteAll}
        title="Delete All Payment Links"
        message={`Are you sure you want to delete all ${paymentLinks.length} payment links? This will deactivate them in Stripe and remove them from this admin panel.`}
        confirmText={`Delete All ${paymentLinks.length} Links`}
        variant="danger"
        loading={deletingAll}
      >
        <div className="bg-red-50 rounded-lg p-4 border border-red-200 mb-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900 mb-1">
                This will delete {paymentLinks.length} payment link{paymentLinks.length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-red-800">
                All links will be deactivated in Stripe and removed from your admin panel. This operation cannot be undone.
              </p>
            </div>
          </div>
        </div>

        {paymentLinks.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 max-h-40 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-700 mb-2">Links to be deleted:</p>
            <div className="space-y-1">
              {paymentLinks.slice(0, 5).map((link) => (
                <div key={link.id} className="text-xs text-gray-600 truncate">
                  • {link.url}
                </div>
              ))}
              {paymentLinks.length > 5 && (
                <div className="text-xs text-gray-500 italic">
                  ... and {paymentLinks.length - 5} more
                </div>
              )}
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
