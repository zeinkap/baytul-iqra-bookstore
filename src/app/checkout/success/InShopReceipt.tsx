"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

export type InShopOrder = {
  id: string;
  items: { title: string; price: number; quantity: number }[];
  total: number;
  finalTotal: number;
  discountAmount: number;
  email?: string | null;
  customerName?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
};

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

/**
 * Receipt screen for in-shop (QR) purchases. Doubles as proof of payment for staff:
 * big amount and time, a short order reference, no shipping/pickup rows.
 */
/** paid = the server confirmed the payment; confirming = checking right after checkout; processing = not paid yet. */
export type ReceiptStatus = "paid" | "confirming" | "processing";

/** Ticking time on the Paid screen: a screenshot can't tick, so staff can tell this is the live screen. */
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return (
    <p className="mt-2 text-sm font-mono text-gray-500 min-h-5" data-testid="receipt-live-clock">
      {now && now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
    </p>
  );
}

export default function InShopReceipt({ order, footer, status }: { order: InShopOrder; footer?: ReactNode; status: ReceiptStatus }) {
  const paidWhen = order.paidAt || order.createdAt;
  const paidText = paidWhen
    ? new Date(paidWhen).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
  const shortRef = order.id.slice(-8).toUpperCase();
  const [wish, setWish] = useState("");
  const [wishState, setWishState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const sendWish = async () => {
    setWishState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, message: wish }),
      });
      if (!res.ok) throw new Error();
      setWishState("sent");
    } catch {
      setWishState("error");
    }
  };

  // A short buzz when the payment is confirmed, so the buyer notices the screen turned green
  useEffect(() => {
    if (status !== "paid") return;
    try {
      navigator.vibrate?.(200);
    } catch {
      // not supported (e.g. iPhone): the green screen is enough
    }
  }, [status]);

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-10" data-testid="in-shop-receipt">
      <div className="flex flex-col items-center mb-4">
        <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={56} height={56} className="w-14 h-14 object-contain" priority />
      </div>

      {status === "paid" ? (
      <div className="text-center mb-6" data-testid="order-success-message" data-status="paid">
        <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-emerald-700">Paid ✓ Enjoy your book!</h1>
        <p className="mt-2 text-2xl font-bold text-gray-900" data-testid="receipt-paid-line">
          {money(order.finalTotal)}
          {paidText && <span className="text-gray-500 font-medium"> · {paidText}</span>}
        </p>
        <p className="text-sm text-gray-600 mt-1">You can take your book with you. Show this screen if anyone asks.</p>
        <LiveClock />
      </div>
      ) : status === "confirming" ? (
        <div className="text-center mb-6" data-testid="receipt-status" data-status="confirming">
          <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Confirming your payment…</h1>
          <p className="mt-2 text-2xl font-bold text-gray-900">{money(order.finalTotal)}</p>
          <p className="text-sm text-gray-600 mt-1">This takes a few seconds. Please keep this page open.</p>
        </div>
      ) : (
        <div className="text-center mb-6" data-testid="receipt-status" data-status="processing">
          <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-amber-700">Payment processing</h1>
          <p className="mt-2 text-2xl font-bold text-gray-900">{money(order.finalTotal)}</p>
          <p className="text-sm text-gray-700 mt-2">
            We haven&apos;t received confirmation of this payment yet. Some payment methods take a few minutes. This page updates by
            itself, and we&apos;ll email your receipt once it&apos;s confirmed.
          </p>
          <p className="text-sm font-semibold text-amber-800 mt-2">Please wait for the green &ldquo;Paid&rdquo; screen before taking the book.</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 mb-6">
        <ul className="divide-y divide-gray-100">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-2">
              <div>
                <p className="text-gray-900 font-medium">{item.title}</p>
                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
              </div>
              <p className="font-semibold text-gray-900">{money(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>
        {order.discountAmount > 0 && (
          <div className="flex justify-between text-sm text-emerald-700 mt-2">
            <span>Discount</span>
            <span>-{money(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline border-t border-gray-100 mt-2 pt-3">
          <span className="font-bold text-gray-900">Total</span>
          <span className="text-xl font-extrabold text-emerald-700">{money(order.finalTotal)}</span>
        </div>
        <p className="text-xs text-gray-500 text-right">Tax included</p>

        <dl className="mt-4 pt-4 border-t border-gray-100 text-sm space-y-2">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Order</dt>
            <dd className="font-mono text-gray-900" data-testid="receipt-short-ref">#{shortRef}</dd>
          </div>
          {order.customerName && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">Name</dt>
              <dd className="text-gray-900">{order.customerName}</dd>
            </div>
          )}
          {status === "paid" && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Receipt sent to</dt>
            <dd className="text-gray-900 text-right break-all" data-testid="receipt-email">{order.email || "your email (Stripe)"}</dd>
          </div>
          )}
        </dl>
        <details className="mt-3 text-xs text-gray-500">
          <summary className="cursor-pointer">Order details</summary>
          <p className="mt-1 break-all font-mono">{order.id}</p>
        </details>
      </div>

      {status === "paid" && (
        <>
      <p className="text-center text-xs text-gray-500 mb-6" data-testid="receipt-email-hint">
        {order.email ? "Your receipt was emailed. Check your spam folder if you don't see it." : "Your receipt email is being prepared…"}
      </p>

      <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 mb-6" data-testid="receipt-wish">
        {wishState === "sent" ? (
          <p className="text-center text-gray-800 font-medium">Thank you! We read every request. 💚</p>
        ) : (
          <>
            <label htmlFor="wish" className="block font-semibold text-gray-900 mb-2">What book do you wish we had here?</label>
            <textarea
              id="wish"
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="A title, author or topic (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white"
              data-testid="receipt-wish-input"
            />
            <button
              onClick={sendWish}
              disabled={wish.trim().length < 2 || wishState === "sending"}
              className="mt-2 px-4 py-2 rounded-lg font-semibold text-gray-800 border border-gray-300 bg-white disabled:opacity-60"
              data-testid="receipt-wish-send"
            >
              {wishState === "sending" ? "Sending…" : "Send"}
            </button>
            {wishState === "error" && <p className="mt-2 text-sm text-red-600">Couldn&apos;t send that. Please try again.</p>}
          </>
        )}
      </div>

      {footer && <div className="mb-6">{footer}</div>}
        </>
      )}

      <div className="text-center">
        <Link href="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600">
          Browse more books
        </Link>
      </div>
    </main>
  );
}
