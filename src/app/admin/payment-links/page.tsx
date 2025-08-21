"use client";
import { useEffect, useState, useCallback } from "react";
import AdminNav from '@/components/AdminNav';
import { toast } from 'react-hot-toast';

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
    customerPhone?: string;
    cartItems?: string;
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
}

export default function AdminPaymentLinksPage() {
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suggestions, setSuggestions] = useState<Book[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [hiding, setHiding] = useState<string | null>(null);
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
      const data = await res.json();
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

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
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
    [setSuggestions]
  );

  async function searchBooks(query: string) {
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
          bookId: book.id 
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

  async function deletePaymentLink(id: string) {
    if (!confirm('Are you sure you want to deactivate this payment link? This will make it unusable but it will still be visible in your Stripe dashboard.')) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/payment-links/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete payment link');
      }

      toast.success('Payment link deactivated successfully!');
      
      // Refresh the payment links list
      await fetchPaymentLinks();
    } catch (error) {
      console.error('Error deleting payment link:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to deactivate payment link');
    } finally {
      setDeleting(null);
    }
  }

  async function hidePaymentLink(id: string) {
    if (!confirm('Are you sure you want to hide this payment link? It will be removed from this list but can be restored later.')) {
      return;
    }

    setHiding(id);
    try {
      const res = await fetch('/api/admin/payment-links/hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentLinkId: id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to hide payment link');
      }

      toast.success('Payment link hidden successfully!');
      
      // Refresh the payment links list
      await fetchPaymentLinks();
    } catch (error) {
      console.error('Error hiding payment link:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to hide payment link');
    } finally {
      setHiding(null);
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

    // Debug: log the timestamp to see what we're getting
    console.log('Timestamp received:', timestamp, typeof timestamp);
    
    // Handle different timestamp formats
    let date: Date;
    
    if (typeof timestamp === 'string') {
      // If it's a string, try to parse it
      date = new Date(timestamp);
    } else if (timestamp > 1000000000000) {
      // If it's a large number, it's likely milliseconds
      date = new Date(timestamp * 1000);
    } else {
      // If it's a smaller number, it's likely seconds
      date = new Date(timestamp * 1000);
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date from timestamp:', timestamp);
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

  function parseCartItems(cartItemsJson?: string): CartItem[] {
    if (!cartItemsJson) return [];
    
    try {
      const items = JSON.parse(cartItemsJson);
      return Array.isArray(items) ? items : [];
    } catch (error) {
      console.error('Error parsing cart items:', error);
      return [];
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                                         <div className="relative autocomplete-container">
                       <label className="block text-xs font-medium text-gray-700 mb-1">
                         Item Title <span className="text-red-500">*</span>
                       </label>
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
                         className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                       />
                       
                       {/* Autocomplete Suggestions */}
                       {showSuggestions === index && suggestions.length > 0 && (
                         <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                           {suggestions.map((book) => (
                             <button
                               key={book.id}
                               onClick={() => selectBook(index, book)}
                               className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                             >
                               <div className="font-medium text-gray-900">{book.title}</div>
                               <div className="text-sm text-gray-600">
                                 by {book.author} • ${book.price.toFixed(2)}
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Payment Links</h2>
              <div className="text-sm text-gray-600">
                {paymentLinks.length} payment link{paymentLinks.length !== 1 ? 's' : ''} found
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-4">Loading...</div>
            ) : paymentLinks.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No payment links found</div>
            ) : (
              <div className="space-y-4">
                {paymentLinks.map((link) => (
                  <div key={link.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Payment Link Details
                        </p>
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
                        {link.metadata?.customerPhone && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Phone:</span> {link.metadata.customerPhone}
                          </p>
                        )}
                        {/* Cart Items with Quantities */}
                        {link.metadata?.cartItems && (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-gray-700 mb-1">Items:</p>
                            <div className="space-y-1">
                              {parseCartItems(link.metadata.cartItems).map((item, index) => (
                                <div key={index} className="text-sm text-gray-600 flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                                  <span className="truncate flex-1">{item.title}</span>
                                  <span className="text-gray-500 ml-2">
                                    Qty: {item.quantity} × ${item.price.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Summary */}
                            {(() => {
                              const items = parseCartItems(link.metadata.cartItems);
                              const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
                              const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                              return (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <div className="flex justify-between text-sm font-medium text-gray-700">
                                    <span>Total Quantity: {totalQuantity}</span>
                                    <span>Total Amount: ${totalAmount.toFixed(2)}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(link.url)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors font-medium"
                        >
                          Copy Link
                        </button>
                        <button
                          onClick={() => hidePaymentLink(link.id)}
                          disabled={hiding === link.id}
                          className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          {hiding === link.id ? 'Hiding...' : 'Hide'}
                        </button>
                        <button
                          onClick={() => deletePaymentLink(link.id)}
                          disabled={deleting === link.id}
                          className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          {deleting === link.id ? 'Deactivating...' : 'Deactivate'}
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-sm font-mono break-all text-gray-900 border border-gray-300 shadow-inner">
                      {link.url}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hidden Payment Links Management */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Hidden Payment Links</h2>
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
      </div>
    </div>
  );
}
