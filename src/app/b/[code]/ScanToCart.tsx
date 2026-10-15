"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/components/CartProvider";

/**
 * Adds the scanned book to the (localStorage) cart once, then sends the
 * customer to /cart. Idempotent: re-scanning a book already in the cart
 * doesn't bump its quantity.
 */
export default function ScanToCart({ book }: { book: Omit<CartItem, "quantity"> }) {
  const { cart, addToCart, isHydrated } = useCart();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (!isHydrated || done.current) return;
    done.current = true;
    if (!cart.some((i) => i.id === book.id)) addToCart(book);
    router.replace("/cart");
  }, [isHydrated, cart, book, addToCart, router]);

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-gray-700">Adding &ldquo;{book.title}&rdquo; to your cart&hellip;</p>
    </main>
  );
}
