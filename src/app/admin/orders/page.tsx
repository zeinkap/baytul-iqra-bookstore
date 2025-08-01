"use client";
import { useEffect, useState, useCallback } from "react";
import AdminNav from '@/components/AdminNav';

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
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
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
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  // Fetch orders
  useEffect(() => {
    fetchOrders();
  }, [pagination.page, fulfillmentFilter]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchOrders();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchText,
        fulfillmentType: fulfillmentFilter,
      });
      
      const res = await fetch(`/api/orders?${params}`);
      if (!res.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await res.json();
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchText, fulfillmentFilter]);

  function handleSearch() {
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function handlePageChange(page: number) {
    setPagination(prev => ({ ...prev, page }));
  }

  function viewOrderDetails(order: Order) {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  }

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

  return (
    <div className="max-w-7xl mx-auto p-6 text-gray-900 bg-white min-h-screen">
      <AdminNav />
      <h1 className="text-3xl font-bold mb-6">Admin: Orders</h1>
      
      {/* Search and Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by email or order ID..."
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
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
        <button
          onClick={handleSearch}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition"
        >
          Search
        </button>
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
                <th className="font-semibold py-3 px-4 text-left">Order ID</th>
                <th className="font-semibold py-3 px-4 text-left">Date</th>
                <th className="font-semibold py-3 px-4 text-left">Email</th>
                <th className="font-semibold py-3 px-4 text-left">Items</th>
                <th className="font-semibold py-3 px-4 text-left">Total</th>
                <th className="font-semibold py-3 px-4 text-left">Fulfillment</th>
                <th className="font-semibold py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    {loading ? 'Loading orders...' : 'No orders found.'}
                  </td>
                </tr>
              ) : (
                orders.map((order, idx) => (
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
        <div className="mt-6 flex justify-center">
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            
            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 border rounded ${
                    page === pagination.page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="px-3 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Order Details</h2>
              <button
                onClick={() => setShowOrderDetails(false)}
                className="text-gray-500 hover:text-gray-700"
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
                  <p><strong>Order ID:</strong> {selectedOrder.id}</p>
                  <p><strong>Date:</strong> {formatDate(selectedOrder.createdAt)}</p>
                  <p><strong>Email:</strong> {selectedOrder.email || 'N/A'}</p>
                  <p><strong>Fulfillment:</strong> {selectedOrder.fulfillmentType}</p>
                  {selectedOrder.pickupLocation && (
                    <p><strong>Pickup Location:</strong> {selectedOrder.pickupLocation}</p>
                  )}
                  {selectedOrder.promoCode && (
                    <p><strong>Promo Code:</strong> {selectedOrder.promoCode.code} ({selectedOrder.promoCode.description})</p>
                  )}
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Shipping Address</h3>
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