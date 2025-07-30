"use client";
import { useCart } from './CartProvider';
import { useEffect, useState } from 'react';

function CartIconBadgeInner() {
  const { cart } = useCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <span 
      className={`absolute -top-1 -right-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs rounded-full min-w-[1.25rem] h-5 flex items-center justify-center font-semibold shadow-lg transition-opacity duration-200 ${
        count > 0 ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function CartIconBadge() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span className="absolute -top-1 -right-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs rounded-full min-w-[1.25rem] h-5 flex items-center justify-center font-semibold shadow-lg transition-opacity duration-200 opacity-0">
        0
      </span>
    );
  }

  return <CartIconBadgeInner />;
} 