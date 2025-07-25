"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/components/CartProvider';
import { toast } from 'react-hot-toast';
import { useState, useEffect } from 'react';

// Add type for book stock information
type BookStock = {
  id: string;
  stock: number;
};

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<'shipping' | 'pickup'>('shipping');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [bookStocks, setBookStocks] = useState<BookStock[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<{
    id: string;
    code: string;
    description: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
    finalTotal: number;
  } | null>(null);
  const [promoCodeError, setPromoCodeError] = useState('');
  const [validatingPromoCode, setValidatingPromoCode] = useState(false);
  
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const shippingFee = fulfillmentType === 'shipping' ? 5 : 0;
  const discountAmount = appliedPromoCode ? appliedPromoCode.discountAmount : 0;
  const grandTotal = total + shippingFee - discountAmount;

  // Fetch stock information for all books in cart
  useEffect(() => {
    const fetchBookStocks = async () => {
      if (cart.length === 0) {
        setLoadingStocks(false);
        return;
      }

      try {
        const stockPromises = cart.map(async (item) => {
          const response = await fetch(`/api/books/${item.id}`);
          if (response.ok) {
            const book = await response.json();
            return { id: item.id, stock: book.stock };
          }
          return { id: item.id, stock: 0 };
        });

        const stocks = await Promise.all(stockPromises);
        setBookStocks(stocks);
      } catch (error) {
        console.error('Error fetching book stocks:', error);
      } finally {
        setLoadingStocks(false);
      }
    };

    fetchBookStocks();
  }, [cart]);

  // Validate applied promo code when cart total changes
  useEffect(() => {
    const validateAppliedPromoCode = async () => {
      if (!appliedPromoCode) return;

      try {
        const response = await fetch('/api/promo-codes/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: appliedPromoCode.code,
            orderTotal: total // Only validate against product total, not shipping
          }),
        });

        const data = await response.json();

        if (!data.valid) {
          // Promo code is no longer valid, remove it
          setAppliedPromoCode(null);
          setPromoCodeError(data.error || 'Promo code is no longer valid');
          toast.error('Promo code removed: ' + (data.error || 'No longer valid'));
        } else {
          // Update the applied promo code with new discount amount
          setAppliedPromoCode(data.promoCode);
        }
      } catch (error) {
        console.error('Error validating applied promo code:', error);
        // On error, remove the promo code to be safe
        setAppliedPromoCode(null);
        setPromoCodeError('Failed to validate promo code');
        toast.error('Promo code removed due to validation error');
      }
    };

    validateAppliedPromoCode();
  }, [total, appliedPromoCode?.code]); // Re-run when total changes or promo code changes

  // Helper function to get stock for a specific book
  const getBookStock = (bookId: string) => {
    const bookStock = bookStocks.find(stock => stock.id === bookId);
    return bookStock ? bookStock.stock : 0;
  };

  return (
    <>
      <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          
          {/* Header Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2">
                  Shopping Cart
                </h1>
                <p className="text-gray-600 text-lg">
                  {cart.length === 0 ? 'Your cart is waiting to be filled' : `${itemCount} item${itemCount !== 1 ? 's' : ''} in your cart`}
                </p>
              </div>
              <Link 
                href="/" 
                className="inline-flex items-center gap-1 sm:gap-2 bg-white/90 hover:bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-sm sm:text-base font-medium backdrop-blur-sm group"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Continue Shopping</span>
                <span className="sm:hidden">Continue</span>
              </Link>
            </div>
            
            {/* Progress indicator */}
            {cart.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">Shopping Progress</span>
                  <span className="text-sm font-medium text-emerald-600">Step 1 of 3</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full w-1/3 transition-all duration-300"></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Cart Review</span>
                  <span>Checkout</span>
                  <span>Complete</span>
                </div>
              </div>
            )}
          </div>

          {/* Fulfillment Type Selection */}
          {cart.length > 0 && (
            <div className="mb-8 bg-white/90 rounded-xl shadow p-6 border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">How would you like to receive your order?</h2>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fulfillmentType"
                    value="shipping"
                    checked={fulfillmentType === 'shipping'}
                    onChange={() => setFulfillmentType('shipping')}
                    className="accent-emerald-600"
                  />
                  <span className="text-gray-900 font-semibold">Ship to my address</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fulfillmentType"
                    value="pickup"
                    checked={fulfillmentType === 'pickup'}
                    onChange={() => setFulfillmentType('pickup')}
                    className="accent-emerald-600"
                  />
                  <span className="text-gray-900 font-semibold">Local Pickup <span className="text-gray-600 font-normal">(Alpharetta, GA)</span></span>
                </label>
              </div>
              <div className="mb-2">
                <label htmlFor="email" className="block text-gray-900 font-semibold mb-1">
                  Email for order confirmation <span className="text-red-600">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setEmailTouched(true);
                  }}
                  required
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-gray-700 text-gray-900"
                  onBlur={() => setEmailTouched(true)}
                />
                {emailTouched && !email && (
                  <p className="text-red-600 text-sm mt-1">Email is required.</p>
                )}
                {emailTouched && email && !/^\S+@\S+\.\S+$/.test(email) && (
                  <p className="text-red-600 text-sm mt-1">Please enter a valid email address.</p>
                )}
              </div>
              {fulfillmentType === 'pickup' && (
                <div className="mt-4 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                  <strong>Pickup Location:</strong> Alpharetta, GA<br />
                  You will receive instructions for pickup after completing your order.
                </div>
              )}
              
              {/* Promo Code Section */}
              <div className="mt-4">
                <label htmlFor="promoCode" className="block text-gray-900 font-semibold mb-1">
                  Promo Code (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="promoCode"
                    type="text"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      setPromoCodeError('');
                    }}
                    placeholder="Enter promo code"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-gray-700 text-gray-900"
                    disabled={validatingPromoCode}
                  />
                  <button
                    onClick={async () => {
                      if (!promoCode.trim()) {
                        setPromoCodeError('Please enter a promo code');
                        return;
                      }
                      
                      setValidatingPromoCode(true);
                      setPromoCodeError('');
                      
                                             try {
                         const response = await fetch('/api/promo-codes/validate', {
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify({
                             code: promoCode.trim(),
                             orderTotal: total // Only validate against product total, not shipping
                           }),
                         });
                        
                        const data = await response.json();
                        
                        if (data.valid) {
                          setAppliedPromoCode(data.promoCode);
                          setPromoCodeError('');
                          toast.success(`Promo code applied! ${data.promoCode.description}`);
                        } else {
                          setPromoCodeError(data.error || 'Invalid promo code');
                          setAppliedPromoCode(null);
                        }
                      } catch {
                        setPromoCodeError('Failed to validate promo code');
                        setAppliedPromoCode(null);
                      } finally {
                        setValidatingPromoCode(false);
                      }
                    }}
                    disabled={validatingPromoCode || !promoCode.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {validatingPromoCode ? 'Validating...' : 'Apply'}
                  </button>
                </div>
                {promoCodeError && (
                  <p className="text-red-600 text-sm mt-1">{promoCodeError}</p>
                )}
                {appliedPromoCode && (
                  <div className="mt-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <strong>✓ {appliedPromoCode.description}</strong>
                        <p className="text-sm">Discount: ${appliedPromoCode.discountAmount.toFixed(2)}</p>
                      </div>
                      <button
                        onClick={() => {
                          setAppliedPromoCode(null);
                          setPromoCode('');
                          setPromoCodeError('');
                        }}
                        className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {cart.length === 0 ? (
            /* Empty Cart State */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl p-12 border border-white/50 text-center max-w-md">
                <div className="w-20 h-20 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Your cart is empty</h2>
                <p className="text-gray-600 mb-8 leading-relaxed">
                  Discover our curated collection of Islamic literature and find your next meaningful read.
                </p>
                <Link 
                  href="/" 
                  className="inline-flex items-center justify-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Start Shopping
                </Link>
              </div>
          </div>
        ) : (
            /* Cart Items */
            <div className="grid lg:grid-cols-3 gap-8">
              
              {/* Cart Items List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4">
                    <div className="flex items-center justify-between text-white">
                      <h2 className="text-xl font-bold">Your Items</h2>
                      <button
                        onClick={() => setShowClearModal(true)}
                        className="text-sm font-medium hover:bg-white/20 px-3 py-1 rounded-lg transition-colors duration-200"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-gray-100">
                    {cart.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="p-6 hover:bg-gray-50/50 transition-colors duration-200">
                        <div className="flex flex-col sm:flex-row gap-6">
                          
                          {/* Book Image */}
                          <div className="relative w-24 h-32 sm:w-28 sm:h-36 flex-shrink-0 mx-auto sm:mx-0">
                            <div className="relative w-full h-full bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                              <Image 
                                src={item.image || '/placeholder.svg'} 
                                alt={item.title} 
                                fill 
                                className="object-contain p-2" 
                                style={{ objectFit: 'contain' }}
                              />
                              {/* Stock indicator */}
                              {!loadingStocks && (
                                <div className="absolute top-2 right-2">
                                  <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    getBookStock(item.id) === 0 ? 'bg-red-100 text-red-800' : 
                                    getBookStock(item.id) === 1 ? 'bg-amber-100 text-amber-800' : 
                                    'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {getBookStock(item.id) === 0 ? 'Out of Stock' : 
                                     getBookStock(item.id) === 1 ? 'Only 1 left!' : 
                                     'In Stock'}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Book Details */}
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 leading-tight">
                                {item.title}
                              </h3>
                              <p className="text-gray-600 text-sm mb-3">by {item.author}</p>
                              
                              {/* Stock Status */}
                              {!loadingStocks && (
                                <div className="flex items-center gap-2 mb-3">
                                  <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${
                                    getBookStock(item.id) === 0 ? 'bg-red-50 border border-red-200 text-red-700' : 
                                    getBookStock(item.id) === 1 ? 'bg-amber-50 border border-amber-200 text-amber-700' : 
                                    'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                  }`}>
                                    <div className={`w-2 h-2 rounded-full ${
                                      getBookStock(item.id) === 0 ? 'bg-red-500' : 
                                      getBookStock(item.id) === 1 ? 'bg-amber-500' : 
                                      'bg-emerald-500'
                                    }`} />
                                    <span>
                                      {getBookStock(item.id) === 0 ? 'Out of stock' : 
                                       getBookStock(item.id) === 1 ? 'Only 1 left!' : 
                                       `${getBookStock(item.id)} in stock`}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Price */}
                              <div className="flex items-center gap-3 mb-4">
                                <span className="text-2xl font-bold text-emerald-600">
                                  ${item.price.toFixed(2)}
                                </span>
                                <span className="text-sm text-gray-500">per item</span>
                              </div>
                            </div>
                            
                            {/* Quantity Controls */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-gray-700">Quantity:</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors duration-200"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={e => updateQuantity(item.id, Math.max(1, Number(e.target.value)))}
                                    className="w-16 px-3 py-2 text-center border-0 focus:ring-0 text-gray-900 bg-white"
                                  />
                                  <button
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors duration-200"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              
                              {/* Remove Button */}
                              <button
                                onClick={() => {
                                  removeFromCart(item.id);
                                  toast.success('Item removed from cart', {
                                    style: {
                                      background: '#ef4444',
                                      color: '#fff',
                                    },
                                    iconTheme: {
                                      primary: '#fff',
                                      secondary: '#ef4444',
                                    },
                                  });
                                }}
                                className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Remove
                              </button>
                            </div>
                            
                            {/* Item Subtotal */}
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Subtotal:</span>
                                <span className="text-lg font-bold text-gray-900">
                                  ${(item.price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden sticky top-24">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                    <h2 className="text-xl font-bold text-white">Order Summary</h2>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Order Details */}
                    <div className="space-y-3">
                      <div className="flex justify-between text-gray-600">
                        <span>Items ({itemCount}):</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>{fulfillmentType === 'pickup' ? 'Local Pickup:' : 'Shipping:'}</span>
                        {fulfillmentType === 'pickup' ? (
                          <span>Free (Alpharetta, GA)</span>
                        ) : (
                          <span>$5 (flat rate)</span>
                        )}
                      </div>
                      {appliedPromoCode && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Discount ({appliedPromoCode.description}):</span>
                          <span>-${appliedPromoCode.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900">Total:</span>
                          <span className="text-2xl font-bold text-gray-900">
                            ${grandTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Checkout Button */}
                    <button
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
                      disabled={loading}
                      onClick={async () => {
                        setLoading(true);
                        try {
                          // Email validation before proceeding
                          setEmailTouched(true);
                          if (!email) {
                            toast.error('Please enter your email.');
                            setLoading(false);
                            return;
                          }
                          if (!/^\S+@\S+\.\S+$/.test(email)) {
                            toast.error('Please enter a valid email address.');
                            setLoading(false);
                            return;
                          }
                          // 1. Create order in DB
                          const orderRes = await fetch('/api/orders', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              items: cart,
                              total,
                              fulfillmentType,
                              pickupLocation: fulfillmentType === 'pickup' ? 'Alpharetta, GA' : undefined,
                              email,
                              promoCodeId: appliedPromoCode?.id,
                              discountAmount: appliedPromoCode?.discountAmount || 0,
                              // Add shippingAddress here if you collect it
                            }),
                          });
                          const orderData = await orderRes.json();
                          if (!orderRes.ok) {
                            toast.error(orderData.error || 'Failed to create order');
                            setLoading(false);
                            return;
                          }
                          const orderId = orderData.id;
                          // 2. Proceed to Stripe checkout
                          const res = await fetch('/api/checkout_sessions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              items: cart, 
                              fulfillmentType, 
                              orderId, 
                              email,
                              promoCodeId: appliedPromoCode?.id 
                            }),
                          });
                          const data = await res.json();
                          if (data.url) {
                            window.location.href = data.url;
                          } else {
                            toast.error(data.error || 'Failed to create Stripe session');
                          }
                        } catch {
                          toast.error('Error connecting to payment gateway.');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      {/* Shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                      
                      <div className="relative z-10 flex items-center justify-center">
                        {loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Proceed to Checkout
                          </>
                        )}
                      </div>
                    </button>
                    
                    {/* Security Info */}
                    <div className="text-center text-sm text-gray-500">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Secure Checkout</span>
                      </div>
                      <p>Your payment information is protected with SSL encryption</p>
                    </div>
                  </div>
                </div>
                
                {/* Additional Benefits */}
                <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4">Why Shop With Us?</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 16.5a1.5 1.5 0 01-3 0V9a1.5 1.5 0 013 0v7.5zM12 4.5a1.5 1.5 0 00-3 0v12a1.5 1.5 0 003 0V4.5zM16 7.5a1.5 1.5 0 00-3 0v9a1.5 1.5 0 003 0v-9z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">Curated Islamic literature</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">Fast & secure shipping</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">100% authentic books</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Clear Cart?</h3>
            <p className="text-gray-700 mb-6">Are you sure you want to remove all items from your cart?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  clearCart();
                  setShowClearModal(false);
                  toast.success('Cart cleared!');
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition"
              >
                Yes, Clear All
              </button>
              <button
                onClick={() => setShowClearModal(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold shadow transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 