"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useCart } from '@/components/CartProvider';
import Button from '@/components/Button';
import { Card } from '@/components/Card';

type OrderItem = {
  title: string;
  price: number;
  quantity: number;
};

type Order = {
  id: string;
  items: OrderItem[];
  total: number;
  finalTotal: number;
  discountAmount: number;
  fulfillmentType: 'shipping' | 'pickup';
  pickupLocation?: string;
  email?: string;
  customerName?: string;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
};

export default function SuccessClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const sessionId = searchParams.get('session_id');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { clearCart } = useCart();
  const clearedRef = useRef(false);
  const notificationSentRef = useRef(false);
  const stockUpdateAttemptedRef = useRef(false);

  // Backup stock update function
  const updateStockBackup = async (orderId: string) => {
    if (stockUpdateAttemptedRef.current) return;
    stockUpdateAttemptedRef.current = true;

    try {
      const response = await fetch(`/api/orders/${orderId}/update-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Backup stock update successful:', result);
      } else {
        console.warn('Backup stock update failed:', await response.text());
      }
    } catch (error) {
      console.error('Backup stock update error:', error);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);

    let isCancelled = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const loadOrderWithRetry = async () => {
      // Try up to 30 seconds waiting for webhook to create the order
      const maxAttempts = 30;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          // On first attempts, try to fetch from our DB by orderId.
          const res = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' });
          if (res.ok) {
            const data: Order = await res.json();
            if (isCancelled) return;
            setOrder(data);
            setLoading(false);
            // Clear cart once
            if (!clearedRef.current) {
              clearCart();
              clearedRef.current = true;
            }
            // Send sales notification once
            if (!notificationSentRef.current && data.email) {
              notificationSentRef.current = true;
              fetch('/api/orders/notify-sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: data.id,
                  items: data.items,
                  total: data.total,
                  fulfillmentType: data.fulfillmentType,
                  customerEmail: data.email,
                  shippingAddress: data.shippingAddress,
                }),
              }).catch((err) => console.error('Failed to send sales notification:', err));
            }
            // Trigger backup stock update
            updateStockBackup(data.id);
            return; // success
          }
          // If not found yet and we have a Stripe session id, ask server to create order from session (idempotent)
          if (sessionId) {
            const createRes = await fetch('/api/orders/from-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            });
            if (createRes.ok) {
              const data: Order = await createRes.json();
              if (isCancelled) return;
              setOrder(data);
              setLoading(false);
              if (!clearedRef.current) {
                clearCart();
                clearedRef.current = true;
              }
              if (!notificationSentRef.current && data.email) {
                notificationSentRef.current = true;
                fetch('/api/orders/notify-sales', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: data.id,
                    items: data.items,
                    total: data.total,
                    fulfillmentType: data.fulfillmentType,
                    customerEmail: data.email,
                    shippingAddress: data.shippingAddress,
                  }),
                }).catch((err) => console.error('Failed to send sales notification:', err));
              }
              // Trigger backup stock update
              updateStockBackup(data.id);
              return; // success after creation
            }
          }
        } catch {
          // ignore and retry
        }
        await sleep(1000); // wait 1s before next attempt
      }
      if (!isCancelled) {
        setError('We are finalizing your order. Please refresh this page in a moment.');
        setLoading(false);
      }
    };

    loadOrderWithRetry();
    return () => {
      isCancelled = true;
    };
  }, [orderId, sessionId, clearCart]);

  if (!orderId) {
    return <div className="max-w-2xl mx-auto p-8 text-center text-red-600 font-bold">Missing order ID.</div>;
  }
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card>
          <Card.Header>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-lg font-semibold text-gray-900">Finalizing your order…</h2>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4 text-gray-700">
              <div className="h-4 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-5/6" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <Card>
          <Card.Body>
            <div className="space-y-4">
              <div className="text-red-600 font-semibold">{error || 'Order not found.'}</div>
              <div className="text-gray-600">This can happen if payment just completed and we are still receiving confirmation.</div>
              <div className="flex items-center justify-center gap-3">
                <Button variant="secondary" onClick={() => window.location.reload()}>Refresh</Button>
                <Button onClick={() => window.location.href = '/'}>Return Home</Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }

  const formatCurrency = (n: number) => `$${Number(n || 0).toFixed(2)}`;
  const formatAddress = (addr?: Order['shippingAddress']) => {
    console.log('Formatting address:', { addr, type: typeof addr });
    
    if (!addr) {
      console.log('No address provided');
      return 'N/A';
    }
    
    // Handle case where shippingAddress might be a JSON string
    let address = addr;
    if (typeof addr === 'string') {
      try {
        address = JSON.parse(addr);
        console.log('Parsed address from string:', address);
      } catch (error) {
        console.error('Failed to parse address string:', error);
        return 'N/A';
      }
    }
    
    if (!address || typeof address !== 'object') {
      console.log('Address is not a valid object:', address);
      return 'N/A';
    }
    
    const parts = [
      address.name, 
      address.line1, 
      address.line2, 
      address.city, 
      address.state, 
      address.postal_code, 
      address.country
    ].filter(Boolean);
    
    console.log('Address parts:', parts);
    const result = parts.length > 0 ? parts.join(', ') : 'N/A';
    console.log('Formatted address result:', result);
    
    return result;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 text-emerald-700">Thank you for your order!</h1>
        <p className="text-gray-700">
          {order.fulfillmentType === 'pickup'
            ? 'This was an in-person sale.'
            : 'Your order will be shipped soon. You will receive a confirmation email with tracking details.'}
        </p>
        {order.fulfillmentType === 'pickup' && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg inline-block">
            <p className="text-sm text-emerald-700">
              📍 <strong>In-Person Sale:</strong> Customer information collected during payment
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Summary */}
        <div className="lg:col-span-2">
          <Card>
            <Card.Header>
              <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>
            </Card.Header>
            <Card.Body>
              <div className="divide-y divide-gray-100">
                {order.items && order.items.map((item: OrderItem, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-3">
                    <div className="pr-4">
                      <div className="font-medium text-gray-900">{item.title}</div>
                      <div className="text-sm text-gray-600">Qty: {Number(item.quantity || 0)}</div>
                    </div>
                    <div className="font-semibold text-gray-900">{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</div>
                  </div>
                ))}
              </div>
              
              {/* Order Summary Totals */}
              <div className="mt-4 border-t border-gray-200 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(order.total)}</span>
                </div>
                
                {order.fulfillmentType === 'shipping' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span className="text-gray-900">$5.00</span>
                  </div>
                )}
                
                {order.fulfillmentType === 'pickup' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Pickup</span>
                    <span className="text-gray-900">Free</span>
                  </div>
                )}
                
                {order.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="text-red-600">-{formatCurrency(order.discountAmount)}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xl font-extrabold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-emerald-700">{formatCurrency(order.finalTotal)}</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Order Info */}
        <div className="lg:col-span-1">
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Order Info</h3>
            </Card.Header>
            <Card.Body>
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-600">Order ID</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-900">{orderId}</span>
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(orderId || ''); } catch {}
                      }}
                    >Copy</Button>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-600">Name</span>
                  <span className="text-gray-900">
                    {order.customerName || (order.fulfillmentType === 'pickup' ? 'In-Person Sale' : 'N/A')}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-600">Email</span>
                  <span className="text-gray-900">
                    {order.email || (order.fulfillmentType === 'pickup' ? 'Not collected (in-person sale)' : 'N/A')}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-gray-600 mb-1">{order.fulfillmentType === 'pickup' ? 'Pickup Details' : 'Shipping Address'}</div>
                  <div className="text-gray-900">
                    {order.fulfillmentType === 'pickup'
                      ? 'Alpharetta, GA (We will email pickup instructions)'
                      : formatAddress(order.shippingAddress)}
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button onClick={() => (window.location.href = '/')}>Continue Shopping</Button>
        <Button
          variant="secondary"
          onClick={() => window.print()}
        >Print Receipt</Button>
        <Button
          variant="secondary"
          onClick={() => (window.location.href = 'mailto:sales@baytulirqra.com')}
        >Contact Support</Button>
      </div>
    </div>
  );
} 