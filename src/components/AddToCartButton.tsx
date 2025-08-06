"use client";
import { useCart } from "./CartProvider";
import { toast } from 'react-hot-toast';

export default function AddToCartButton({
  id,
  title,
  author,
  price,
  image,
  stock = 0,
}: {
  id: string;
  title: string;
  author: string;
  price: number;
  image: string;
  stock?: number;
}) {
  const { addToCart } = useCart();

  const isOutOfStock = stock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) {
      toast.error('This item is out of stock', {
        style: {
          background: '#ef4444',
          color: '#fff',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#ef4444',
        },
      });
      return;
    }

    addToCart({ id, title, author, price, image });
    toast.success('Added to cart!', {
      style: {
        background: '#f59e0b',
        color: '#fff',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#f59e0b',
      },
    });
  };

  return (
    <button
      className={`w-full px-6 py-3.5 rounded-xl font-semibold flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl transform active:scale-95 group relative overflow-hidden ${
        isOutOfStock
          ? 'bg-gray-400 text-gray-600 cursor-not-allowed hover:shadow-lg transform-none'
          : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white hover:scale-105'
      }`}
      onClick={handleAddToCart}
      disabled={isOutOfStock}
    >
      {/* Shine effect overlay - only show when not out of stock */}
      {!isOutOfStock && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
      )}
      
      {/* Button content */}
      <svg className="w-5 h-5 mr-2.5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
      <span className="relative z-10 font-bold tracking-wide">
        {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
      </span>
    </button>
  );
} 