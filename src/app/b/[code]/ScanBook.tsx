"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useCart, type CartItem } from "@/components/CartProvider";

type ScannedBook = Omit<CartItem, "quantity">;

/**
 * Landing page for a scanned QR label. Shows the book so the customer can confirm
 * (guards against accidental scans), then either:
 *  - "Buy now": order + Stripe Checkout for just this book (Stripe collects the email), or
 *  - "Add to cart": idempotently adds it and opens the email-only cart to buy several.
 */
export default function ScanBook({ book, code, stock }: { book: ScannedBook; code: string; stock: number }) {
  const { cart, addToCart, isHydrated } = useCart();
  const router = useRouter();
  const [buying, setBuying] = useState(false);

  const markInShop = () => {
    try {
      // Tells the cart page to skip the shipping/pickup choice and ask only for email
      sessionStorage.setItem("checkoutMode", "in-shop");
    } catch {
      // sessionStorage unavailable: the customer just sees the normal cart form
    }
  };

  const handleAddToCart = () => {
    markInShop();
    if (!cart.some((i) => i.id === book.id)) addToCart(book);
    router.push("/cart");
  };

  const handleBuyNow = async () => {
    setBuying(true);
    let navigating = false;
    try {
      const items = [{ ...book, quantity: 1 }];
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          total: book.price,
          fulfillmentType: "pickup",
          pickupLocation: "In shop",
          source: "in-shop",
        }),
      });
      const order = await orderRes.json();
      if (orderRes.status === 409) {
        // Someone bought the last copy since this page loaded: re-render the server page (out-of-stock message)
        toast.error(order.error || "Sorry, this book just sold out.");
        router.refresh();
        return;
      }
      if (!orderRes.ok) throw new Error(order.error || "Failed to create order");

      const sessionRes = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          fulfillmentType: "pickup",
          pickupLocation: "In shop",
          orderId: order.id,
          source: "in-shop",
          cancelPath: `/b/${code}`,
        }),
      });
      const data = await sessionRes.json();
      if (sessionRes.status === 409) {
        toast.error(data.error || "Sorry, this book just sold out.");
        router.refresh();
        return;
      }
      if (!data.url) throw new Error(data.error || "Failed to start checkout");
      navigating = true;
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      // Stay disabled while navigating to Stripe; on any failure the buttons must work again
      if (!navigating) setBuying(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-8" data-testid="scan-book-card">
      <div className="flex flex-col items-center mb-4">
        <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={64} height={64} className="w-16 h-16 object-contain" priority />
        <p className="mt-1 text-sm font-semibold text-emerald-800">Baytul Iqra Bookstore</p>
      </div>
      <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 text-center">
        {book.image && (
          <div className="relative mx-auto mb-4 w-40 h-56">
            <Image src={book.image} alt={book.title} fill sizes="160px" className="object-contain" priority />
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-900" data-testid="scan-book-title">{book.title}</h1>
        <p className="text-gray-600 mb-2">{book.author}</p>
        <p className="text-2xl font-extrabold text-emerald-700">${book.price.toFixed(2)}</p>
        <p className="text-xs text-gray-500 mb-2" data-testid="scan-tax-note">Tax included</p>
        {stock <= 3 && (
          <p className="text-sm font-semibold text-amber-700 mb-3" data-testid="scan-low-stock">
            {stock === 1 ? "Last copy!" : `Only ${stock} left`}
          </p>
        )}
        <div className="mb-3" />

        <button
          onClick={handleBuyNow}
          disabled={buying || !isHydrated}
          data-testid="scan-buy-now"
          className="w-full px-6 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 disabled:opacity-60"
        >
          {buying ? "Opening checkout…" : `Buy now · $${book.price.toFixed(2)}`}
        </button>
        <button
          onClick={handleAddToCart}
          disabled={buying || !isHydrated}
          data-testid="scan-add-to-cart"
          className="w-full mt-3 px-6 py-3 rounded-xl font-semibold text-gray-800 border border-gray-300 bg-white disabled:opacity-60"
        >
          Add to cart (buying more than one?)
        </button>
        <Link href="/" className="inline-block mt-4 text-sm text-gray-500 underline">
          Browse more books
        </Link>
      </div>
    </main>
  );
}
