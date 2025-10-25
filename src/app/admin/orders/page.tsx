"use client";
import { useEffect, useState, useCallback } from "react";

// Order types
interface OrderItem {
  id: string;
  title: string;
  author: string;
  price: number;
  quantity: number;
  image: string;
}

interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface PromoCode {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
}

interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  discountAmount: number;
  finalTotal: number;
  promoCodeId: string | null;
  promoCode: PromoCode | null;
  fulfillmentType: string;
  pickupLocation: string | null;
  shippingAddress: ShippingAddress | null;
  email: string | null;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface OrderStats {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [stats, setStats] = useState<OrderStats>({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
  });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: debouncedSearch,
        fulfillmentType: fulfillmentFilter,
      });
      
      const res = await fetch(`/api/orders?${params}`);
      if (!res.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await res.json();
      setOrders(data.orders);
      setPagination(data.pagination);
      
      // Calculate stats
      const totalRevenue = data.orders.reduce((sum: number, order: Order) => sum + order.finalTotal, 0);
      const totalOrders = data.pagination.total;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      setStats({
        totalRevenue,
        totalOrders,
        averageOrderValue,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, fulfillmentFilter]);

  // Fetch orders
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Sorting function
  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  // Sort data based on current sort field and direction
  function getSortedData(data: Order[]) {
    return [...data].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'id':
          aValue = a.id.toLowerCase();
          bValue = b.id.toLowerCase();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'customerName':
          aValue = (a.customerName || '').toLowerCase();
          bValue = (b.customerName || '').toLowerCase();
          break;
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          break;
        case 'items':
          aValue = Array.isArray(a.items) ? a.items.length : 0;
          bValue = Array.isArray(b.items) ? b.items.length : 0;
          break;
        case 'total':
          aValue = a.finalTotal;
          bValue = b.finalTotal;
          break;
        case 'fulfillment':
          aValue = a.fulfillmentType.toLowerCase();
          bValue = b.fulfillmentType.toLowerCase();
          break;
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Debounced search - update debouncedSearch after delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchText);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  function handlePageChange(page: number) {
    setPagination(prev => ({ ...prev, page }));
  }

  function viewOrderDetails(order: Order) {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  }

  function closeOrderDetails() {
    setShowOrderDetails(false);
    setSelectedOrder(null);
  }

  // Close modal on ESC key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && showOrderDetails) {
        closeOrderDetails();
      }
    }
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showOrderDetails]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatAddress(address: ShippingAddress | null) {
    if (!address) return 'N/A';
    const parts = [
      address.name,
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  }

  function exportToCSV() {
    // Create CSV content
    const headers = ['Order ID', 'Date', 'Customer Name', 'Email', 'Items', 'Subtotal', 'Discount', 'Final Total', 'Fulfillment Type', 'Pickup Location', 'Shipping Address'];
    const rows = orders.map(order => [
      order.id,
      formatDate(order.createdAt),
      order.customerName || 'N/A',
      order.email || 'N/A',
      `${Array.isArray(order.items) ? order.items.length : 0} items`,
      `$${order.total.toFixed(2)}`,
      `$${order.discountAmount.toFixed(2)}`,
      `$${order.finalTotal.toFixed(2)}`,
      order.fulfillmentType,
      order.pickupLocation || 'N/A',
      formatAddress(order.shippingAddress),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getPaginationRange() {
    const { page, pages } = pagination;
    const delta = 2;
    const range: (number | string)[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(pages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (page + delta < pages - 1) {
      rangeWithDots.push('...', pages);
    } else if (pages > 1) {
      rangeWithDots.push(pages);
    }

    return rangeWithDots;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 text-gray-900 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin: Orders</h1>
        <button
          onClick={exportToCSV}
          disabled={orders.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold shadow transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 shadow">
          <div className="text-sm text-blue-600 font-medium mb-1">Total Orders</div>
          <div className="text-2xl font-bold text-blue-900">{stats.totalOrders}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 shadow">
          <div className="text-sm text-green-600 font-medium mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-green-900">${stats.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 shadow">
          <div className="text-sm text-purple-600 font-medium mb-1">Avg Order Value</div>
          <div className="text-2xl font-bold text-purple-900">${stats.averageOrderValue.toFixed(2)}</div>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by email, customer name, or order ID..."
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {searchText && (
            <div className="text-xs text-gray-500 mt-1">
              Searching... Results will appear after you stop typing
            </div>
          )}
        </div>
        <select
          value={fulfillmentFilter}
          onChange={(e) => setFulfillmentFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Fulfillment Types</option>
          <option value="shipping">Shipping</option>
          <option value="pickup">Pickup</option>
        </select>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-blue-600 mb-4">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 font-semibold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
          </svg>
          {error}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th 
                  className="font-semibold py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Order ID</span>
                    {sortField === 'id' && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="font-semibold py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    {sortField === 'createdAt' && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="font-semibold py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('customerName')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Customer</span>
                    {sortField === 'customerName' && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="font-semibold py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Email</span>
                    {sortField === 'email' && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="font-semibold py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('items')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Items</span>
                    {sortField === 'items' && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="font-semibold py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Total</span>
                    {sortField === 'total' && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="font-semibold py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                  onClick={() => handleSort('fulfillment')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Fulfillment</span>
                    {sortField === 'fulfillment' && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="font-semibold py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    {loading ? 'Loading orders...' : 'No orders found.'}
                  </td>
                </tr>
              ) : (
                getSortedData(orders).map((order, idx) => (
                  <tr
                    key={order.id}
                    className={
                      idx % 2 === 0
                        ? "bg-white hover:bg-blue-50 transition"
                        : "bg-gray-50 hover:bg-blue-50 transition"
                    }
                  >
                    <td className="py-3 px-4 font-mono text-xs">{order.id.slice(0, 8)}...</td>
                    <td className="py-3 px-4">{formatDate(order.createdAt)}</td>
                    <td className="py-3 px-4">{order.customerName || 'N/A'}</td>
                    <td className="py-3 px-4">{order.email || 'N/A'}</td>
                    <td className="py-3 px-4">
                      {Array.isArray(order.items) ? order.items.length : 0} items
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      ${order.finalTotal.toFixed(2)}
                      {order.discountAmount > 0 && (
                        <span className="text-green-600 text-xs block">
                          -${order.discountAmount.toFixed(2)} discount
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.fulfillmentType === 'pickup' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {order.fulfillmentType === 'pickup' ? 'Pickup' : 'Shipping'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => viewOrderDetails(order)}
                        className="text-blue-600 hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-4">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            ← Previous
          </button>
          
          <div className="flex gap-2">
            {getPaginationRange().map((page, idx) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-3 py-2 text-gray-400">
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page as number)}
                  className={`px-3 py-2 border rounded transition ${
                    page === pagination.page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            Next →
          </button>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeOrderDetails}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Order Details</h2>
              <button
                onClick={closeOrderDetails}
                className="text-gray-500 hover:text-gray-700 transition"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Order Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Order Information</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Order ID:</strong> <span className="font-mono text-xs">{selectedOrder.id}</span></p>
                  <p><strong>Date:</strong> {formatDate(selectedOrder.createdAt)}</p>
                  <p><strong>Customer Name:</strong> {selectedOrder.customerName || 'N/A'}</p>
                  <p><strong>Email:</strong> {selectedOrder.email || 'N/A'}</p>
                  <p><strong>Fulfillment:</strong> {selectedOrder.fulfillmentType}</p>
                  {selectedOrder.pickupLocation && (
                    <p><strong>Pickup Location:</strong> {selectedOrder.pickupLocation}</p>
                  )}
                  {selectedOrder.promoCode && (
                    <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
                      <p className="text-green-800"><strong>Promo Code:</strong> {selectedOrder.promoCode.code}</p>
                      <p className="text-green-700 text-xs">{selectedOrder.promoCode.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  {selectedOrder.fulfillmentType === 'shipping' ? 'Shipping Address' : 'Pickup Information'}
                </h3>
                <p className="text-sm">{formatAddress(selectedOrder.shippingAddress)}</p>
              </div>
            </div>

            {/* Items */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Order Items</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                {Array.isArray(selectedOrder.items) ? (
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <div className="flex-1">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-gray-600">by {item.author}</p>
                          <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                          <p className="text-sm text-gray-500">${item.price.toFixed(2)} each</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No items found</p>
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Subtotal:</span>
                <span>${selectedOrder.total.toFixed(2)}</span>
              </div>
              {selectedOrder.discountAmount > 0 && (
                <div className="flex justify-between items-center text-green-600">
                  <span>Discount:</span>
                  <span>-${selectedOrder.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-bold border-t border-gray-200 pt-2 mt-2">
                <span>Total:</span>
                <span>${selectedOrder.finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 