"use client";

import { useState, type ReactNode } from "react";
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

/** a***@gmail.com: enough to recognise the address without showing all of it on a shared screen. */
const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 1)}***@${domain}` : email;
};

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

/**
 * Receipt screen for in-shop (QR) purchases. Doubles as proof of payment for staff:
 * big amount and time, a short order reference, no shipping/pickup rows.
 */
export default function InShopReceipt({ order, footer }: { order: InShopOrder; footer?: ReactNode }) {
  const paidWhen = order.paidAt || order.createdAt;
  const paidText = paidWhen
    ? new Date(paidWhen).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
  const shortRef = order.id.slice(-8).toUpperCase();
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendMessage, setSendMessage] = useState("");
  const canSend = !!order.email && !!order.paidAt;

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

  const emailReceipt = async () => {
    setSendState("sending");
    setSendMessage("");
    try {
      const res = await fetch(`/api/orders/${order.id}/send-receipt`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the receipt. Please try again.");
      setSendState("sent");
    } catch (e) {
      setSendState("error");
      setSendMessage(e instanceof Error ? e.message : "Could not send the receipt. Please try again.");
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-10" data-testid="in-shop-receipt">
      <div className="flex flex-col items-center mb-4">
        <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={56} height={56} className="w-14 h-14 object-contain" priority />
      </div>

      <div className="text-center mb-6" data-testid="order-success-message">
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
      </div>

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
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Receipt sent to</dt>
            <dd className="text-gray-900 text-right break-all" data-testid="receipt-email">{order.email || "your email (Stripe)"}</dd>
          </div>
        </dl>
        <details className="mt-3 text-xs text-gray-500">
          <summary className="cursor-pointer">Order details</summary>
          <p className="mt-1 break-all font-mono">{order.id}</p>
        </details>
      </div>

      <div className="text-center mb-6">
        <button
          onClick={emailReceipt}
          disabled={!canSend || sendState === "sending" || sendState === "sent"}
          data-testid="receipt-email-button"
          className="px-5 py-2.5 rounded-xl font-semibold text-gray-800 border border-gray-300 bg-white disabled:opacity-60"
        >
          {sendState === "sending" ? "Sending…" : sendState === "sent" ? "Receipt sent ✓" : "Email me my receipt"}
        </button>
        <p className="mt-2 text-xs text-gray-500" data-testid="receipt-email-hint">
          {sendState === "sent" && order.email
            ? `Sent to ${maskEmail(order.email)}. Check your spam folder if you don't see it.`
            : sendState === "error"
            ? sendMessage
            : canSend
            ? `We'll send it to ${maskEmail(order.email as string)}.`
            : "Your receipt email is being prepared…"}
        </p>
      </div>

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

      <div className="text-center">
        <Link href="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600">
          Browse more books
        </Link>
      </div>
    </main>
  );
}
