"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useCart } from '@/components/CartProvider';

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
};

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { clearCart } = useCart();
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    fetch(`/api/orders/${orderId}`)
      .then(res => res.json())
      .then((data: Order) => {
        setOrder(data);
        setLoading(false);
        if (!clearedRef.current) {
          clearCart();
          clearedRef.current = true;
        }
      })
      .catch(() => {
        setError("Failed to load order.");
        setLoading(false);
      });
  }, [orderId]);

  if (!orderId) {
    return <div className="max-w-2xl mx-auto p-8 text-center text-red-600 font-bold">Missing order ID.</div>;
  }
  if (loading) {
    return <div className="max-w-2xl mx-auto p-8 text-center">Loading your order...</div>;
  }
  if (error || !order) {
    return <div className="max-w-2xl mx-auto p-8 text-center text-red-600 font-bold">{error || "Order not found."}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <h1 className="text-3xl font-bold mb-4 text-emerald-700">Thank you for your order!</h1>
      <p className="mb-6 text-lg text-gray-700">
        {order.fulfillmentType === 'pickup' ? (
          <>
            Your order is ready for <span className="font-semibold">free local pickup</span> in <span className="font-semibold">Alpharetta, GA</span>.<br />
            We&apos;ll contact you soon with pickup instructions.
          </>
        ) : (
          <>
            Your order will be shipped to your address.<br />
            You&apos;ll receive a confirmation email with tracking details soon.
          </>
        )}
      </p>
      <div className="bg-white rounded-xl shadow p-6 mb-6 text-left">
        <h2 className="text-xl font-semibold mb-2 text-gray-900">Order Summary</h2>
        <ul className="mb-4">
          {order.items && order.items.map((item: OrderItem, idx: number) => (
            <li key={idx} className="flex justify-between border-b border-gray-100 py-2 text-gray-900">
              <span>{item.title} x{item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-bold text-lg text-gray-900">
          <span>Total:</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
      </div>
      <div className="text-gray-500 text-sm">Order ID: {orderId}</div>
    </div>
  );
} 