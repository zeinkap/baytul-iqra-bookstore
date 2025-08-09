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
  fulfillmentType: 'shipping' | 'pickup';
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
    if (!addr) return 'N/A';
    const parts = [addr.name, addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean);
    return parts.join(', ');
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
            ? 'We will contact you shortly with local pickup instructions.'
            : 'Your order will be shipped soon. You will receive a confirmation email with tracking details.'}
        </p>
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
              <div className="mt-4 border-t border-gray-200 pt-4 flex items-center justify-between text-xl font-extrabold text-gray-900">
                <span>Total</span>
                <span className="text-emerald-700">{formatCurrency(Number((order as unknown as { finalTotal?: number }).finalTotal ?? order.total ?? 0))}</span>
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
                  <span className="text-gray-900">{order.customerName || 'N/A'}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-600">Email</span>
                  <span className="text-gray-900">{order.email || 'N/A'}</span>
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