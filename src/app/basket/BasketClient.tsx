"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-hot-toast";
import InShopPayButtons from "@/components/InShopPayButtons";
import {
  basketCount,
  basketTotal,
  refreshBasket,
  removeFromBasket,
  setBasketQuantity,
  useInShopBasket,
  type BasketLine,
} from "@/lib/inShopBasket";

const money = (n: number) => `$${n.toFixed(2)}`;

export default function BasketClient() {
  const basket = useInShopBasket();
  const { lines, location } = basket;
  const checkedRef = useRef(false);

  // Re-read prices and stock from the server, so the customer sees what they will really pay
  const reload = (current: BasketLine[]) => {
    fetch("/api/in-shop/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: current.map((l) => ({ id: l.id, quantity: l.quantity })) }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((fresh: { lines: BasketLine[]; removed: string[] } | null) => {
        if (!fresh) return;
        refreshBasket(fresh);
        if (fresh.removed.length > 0) toast.error("A book in your basket just sold out, so we removed it.");
      })
      .catch(() => {
        // keep what we have; the server re-prices at payment anyway
      });
  };

  // Once when the basket first has books in it
  const hasLines = lines.length > 0;
  useEffect(() => {
    if (!hasLines || checkedRef.current) return;
    checkedRef.current = true;
    reload(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLines]);

  const total = basketTotal(lines);

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-52 sm:pb-8" data-testid="in-shop-basket">
      <div className="flex flex-col items-center mb-4">
        <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={64} height={64} className="w-16 h-16 object-contain" priority />
        <p className="mt-1 text-sm font-semibold text-emerald-800">Baytul Iqra Bookstore</p>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">Your basket</h1>

      {lines.length === 0 ? (
        <div className="text-center" data-testid="basket-empty">
          <p className="text-gray-600 mb-6">Your basket is empty. Scan a book&apos;s QR code with your phone camera to add it.</p>
          <Link href="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500">
            Browse all books
          </Link>
        </div>
      ) : (
        <>
          <ul className="bg-white rounded-2xl shadow border border-gray-100 divide-y divide-gray-100 mb-4" data-testid="basket-lines">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-3 p-4" data-testid="basket-line">
                {line.image ? (
                  <Image src={line.image} alt={line.title} width={56} height={80} className="w-14 h-20 object-contain shrink-0" />
                ) : (
                  <div className="w-14 h-20 bg-gray-100 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <Link href={`/b/${encodeURIComponent(line.code)}${location ? `?loc=${location}` : ""}`} className="font-semibold text-gray-900 line-clamp-2">
                    {line.title}
                  </Link>
                  <p className="text-sm text-gray-600 truncate">{line.author}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBasketQuantity(line.id, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        aria-label={`Fewer copies of ${line.title}`}
                        data-testid="basket-qty-minus"
                        className="w-9 h-9 rounded-full border border-gray-300 text-lg font-semibold text-gray-800 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center font-semibold text-gray-900" data-testid="basket-qty-value">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setBasketQuantity(line.id, line.quantity + 1)}
                        disabled={line.quantity >= Math.min(line.stock, 10)}
                        aria-label={`More copies of ${line.title}`}
                        data-testid="basket-qty-plus"
                        className="w-9 h-9 rounded-full border border-gray-300 text-lg font-semibold text-gray-800 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-bold text-emerald-700" data-testid="basket-line-total">{money(line.price * line.quantity)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromBasket(line.id)}
                    data-testid="basket-remove"
                    className="mt-2 text-sm text-gray-500 underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-between items-baseline px-1 mb-1">
            <span className="font-bold text-gray-900">Total ({basketCount(lines)} {basketCount(lines) === 1 ? "book" : "books"})</span>
            <span className="text-xl font-extrabold text-emerald-700" data-testid="basket-total">{money(total)}</span>
          </div>
          <p className="text-xs text-gray-500 text-right px-1 mb-4">Tax included</p>
          <p className="text-sm text-gray-600 text-center mb-4" data-testid="basket-scan-hint">
            Want another book? Scan its QR code with your camera and tap <b>Add to basket</b>.
          </p>

          <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:p-0">
            <div className="max-w-md mx-auto">
              <InShopPayButtons
                items={lines.map((l) => ({ id: l.id, quantity: l.quantity }))}
                amountCents={lines.reduce((sum, l) => sum + Math.round(l.price * 100) * l.quantity, 0)}
                location={location}
                cancelPath="/basket"
                reportCode="basket"
                onConflict={() => reload(lines)}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
