"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
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
export default function ScanBook({
  book,
  code,
  stock,
  description,
  ageRange,
  images,
}: {
  book: ScannedBook;
  code: string;
  stock: number;
  description?: string;
  ageRange?: string;
  images: string[];
}) {
  const { cart, addToCart, isHydrated } = useCart();
  const router = useRouter();
  const [buying, setBuying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const gallery = images.filter((src) => typeof src === "string" && src.length > 0);
  const chips = [ageRange && (/^\d/.test(ageRange) ? `Ages ${ageRange}` : ageRange), book.format].filter(Boolean) as string[];

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

  const price = `$${book.price.toFixed(2)}`;

  return (
    // Extra bottom padding on phones so the pinned Buy now bar never covers content
    <main className="max-w-md mx-auto px-4 pt-6 pb-32 sm:pb-8" data-testid="scan-book-card">
      <div className="flex flex-col items-center mb-4">
        <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={64} height={64} className="w-16 h-16 object-contain" priority />
        <p className="mt-1 text-sm font-semibold text-emerald-800">Baytul Iqra Bookstore</p>
      </div>
      <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 text-center">
        {book.image && (
          <>
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label={`View larger photos of ${book.title}`}
              data-testid="scan-cover"
              className="relative block mx-auto w-40 h-56"
            >
              <Image src={book.image} alt={book.title} fill sizes="160px" className="object-contain" priority />
            </button>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              {gallery.length > 1 ? `Tap to enlarge · ${gallery.length} photos` : "Tap to enlarge"}
            </p>
          </>
        )}
        <h1 className="text-xl font-bold text-gray-900" data-testid="scan-book-title">{book.title}</h1>
        <p className="text-gray-600 mb-3">{book.author}</p>

        {chips.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-3" data-testid="scan-chips">
            {chips.map((chip) => (
              <span key={chip} className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-medium">
                {chip}
              </span>
            ))}
          </div>
        )}

        {description && (
          <div className="mb-4 text-left" data-testid="scan-description">
            <p className={`text-sm text-gray-700 whitespace-pre-line ${expanded ? "" : "line-clamp-3"}`}>{description}</p>
            {description.length > 140 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-sm font-medium text-emerald-700 underline"
                data-testid="scan-read-more"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        <p className="text-2xl font-extrabold text-emerald-700">{price}</p>
        <p className="text-xs text-gray-500 mb-2" data-testid="scan-tax-note">Tax included</p>
        {stock <= 3 && (
          <p className="text-sm font-semibold text-amber-700 mb-3" data-testid="scan-low-stock">
            {stock === 1 ? "Last copy!" : `Only ${stock} left`}
          </p>
        )}

        {/* Pinned to the bottom of the screen on phones (thumb reach); sits in the card on larger screens */}
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:p-0 sm:mt-4">
          <button
            onClick={handleBuyNow}
            disabled={buying || !isHydrated}
            data-testid="scan-buy-now"
            className="w-full max-w-md mx-auto block px-6 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 disabled:opacity-60"
          >
            {buying ? "Opening checkout…" : `Buy now · ${price}`}
          </button>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={buying || !isHydrated}
          data-testid="scan-add-to-cart"
          className="w-full mt-3 px-6 py-3 rounded-xl font-semibold text-gray-800 border border-gray-300 bg-white disabled:opacity-60"
        >
          Add to cart (buying more than one?)
        </button>

        <p className="mt-4 text-xs text-gray-500" data-testid="scan-trust-note">
          🔒 Secure checkout by Stripe. Apple Pay and Google Pay where available. Your receipt is emailed to you, and you can take the book with you right after paying.
        </p>
        <Link href="/" className="inline-block mt-3 text-sm text-gray-500 underline">
          Browse more books
        </Link>
      </div>
      <Lightbox
        open={zoomOpen}
        close={() => setZoomOpen(false)}
        slides={gallery.map((src) => ({ src, alt: book.title }))}
        plugins={[Zoom]}
        carousel={{ finite: gallery.length <= 1 }}
        render={gallery.length <= 1 ? { buttonPrev: () => null, buttonNext: () => null } : undefined}
      />
    </main>
  );
}
