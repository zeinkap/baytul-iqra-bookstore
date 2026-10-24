"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { useRouter } from "next/navigation";
import type { CartItem } from "@/components/CartProvider";
import InShopPayButtons from "@/components/InShopPayButtons";
import { addToBasket, basketCount, useInShopBasket } from "@/lib/inShopBasket";

type ScannedBook = Omit<CartItem, "quantity">;

// Plenty for a walk-in sale; the server still checks real stock
const MAX_SCAN_QUANTITY = 10;

/**
 * Landing page for a scanned QR label. Shows the book so the customer can confirm
 * (guards against accidental scans). Pay right here with Apple Pay / Google Pay (or by card through Stripe Checkout),
 * or add the book to the in-shop basket to pay for several books at once.
 */
export default function ScanBook({
  book,
  code,
  stock,
  description,
  ageRange,
  images,
  location,
}: {
  book: ScannedBook;
  code: string;
  stock: number;
  description?: string;
  ageRange?: string;
  images: string[];
  location?: string;
}) {
  const router = useRouter();
  const basket = useInShopBasket();
  const inBasket = basket.lines.find((l) => l.id === book.id)?.quantity ?? 0;
  // Once the customer is building a basket, scanning adds to it instead of paying for one book on its own
  const basketMode = basket.lines.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const maxQuantity = Math.min(stock, MAX_SCAN_QUANTITY);
  const gallery = images.filter((src) => typeof src === "string" && src.length > 0);
  const chips = [ageRange && (/^\d/.test(ageRange) ? `Ages ${ageRange}` : ageRange), book.format].filter(Boolean) as string[];

  const handleAddToBasket = () => {
    addToBasket({ id: book.id, code, title: book.title, author: book.author, price: book.price, image: book.image, stock }, quantity, location);
    // The basket page is where they pay, or go scan the next book
    router.push("/basket");
  };

  const price = `$${book.price.toFixed(2)}`;
  const total = `$${(book.price * quantity).toFixed(2)}`;

  return (
    // Extra bottom padding on phones so the pinned Buy now bar never covers content
    <main className="max-w-md mx-auto px-4 pt-6 pb-52 sm:pb-8" data-testid="scan-book-card">
      {/* Open the connection to Stripe while the customer reads, so Buy now lands on checkout faster */}
      <link rel="preconnect" href="https://checkout.stripe.com" />
      <link rel="preconnect" href="https://js.stripe.com" />
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
        {maxQuantity > 1 && (
          <div className="flex items-center justify-center gap-4 mb-3" data-testid="scan-quantity">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Fewer copies"
              data-testid="scan-qty-minus"
              className="w-11 h-11 rounded-full border border-gray-300 text-xl font-semibold text-gray-800 disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-[5rem] text-center text-gray-900 font-semibold" data-testid="scan-qty-value" aria-live="polite">
              {quantity} {quantity === 1 ? "copy" : "copies"}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              disabled={quantity >= maxQuantity}
              aria-label="More copies"
              data-testid="scan-qty-plus"
              className="w-11 h-11 rounded-full border border-gray-300 text-xl font-semibold text-gray-800 disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}
        {stock <= 3 && (
          <p className="text-sm font-semibold text-amber-700 mb-3" data-testid="scan-low-stock">
            {stock === 1 ? "Last copy!" : `Only ${stock} left`}
          </p>
        )}

        {inBasket > 0 && (
          <p className="text-sm font-medium text-emerald-700 mb-2" data-testid="scan-in-basket">
            {inBasket} {inBasket === 1 ? "copy" : "copies"} already in your basket
          </p>
        )}

        {/* Pinned to the bottom of the screen on phones (thumb reach); sits in the card on larger screens */}
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:p-0 sm:mt-4">
          <div className="max-w-md mx-auto space-y-2">
            {basketMode ? (
              <>
                <button
                  onClick={handleAddToBasket}
                  data-testid="scan-add-to-basket"
                  className="w-full block px-6 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500"
                >
                  Add to basket · {total}
                </button>
                <Link href="/basket" data-testid="scan-view-basket" className="block text-center text-sm font-semibold text-emerald-700 underline">
                  Review basket &amp; pay ({basketCount(basket.lines)})
                </Link>
              </>
            ) : (
              <>
                <InShopPayButtons
                  items={[{ id: book.id, quantity }]}
                  amountCents={Math.round(book.price * 100) * quantity}
                  location={location}
                  cancelPath={`/b/${code}${location ? `?loc=${location}` : ""}`}
                  reportCode={code}
                  onConflict={() => router.refresh()}
                />
                <button
                  onClick={handleAddToBasket}
                  data-testid="scan-add-to-basket"
                  className="block mx-auto text-sm font-semibold text-emerald-700 underline"
                >
                  Buying more than one book? Add to basket
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500" data-testid="scan-trust-note">
          🔒 Secure checkout by Stripe. Apple Pay and Google Pay where available. Your receipt is emailed to you, and you can take your books with you right after paying.
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
