"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { loadStripe, type Stripe as StripeJs, type StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { Elements, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { reportScanFailure } from "@/lib/reportScanFailure";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<StripeJs | null> | null = null;
// Stripe.js is only fetched on pages that show a pay button, and only once
const getStripe = () => (publishableKey ? (stripePromise ??= loadStripe(publishableKey)) : null);

type PayItem = { id: string; quantity: number };

type Props = {
  items: PayItem[];
  /** Total in cents, as shown to the customer: the wallet sheet displays it, the server re-prices everything. */
  amountCents: number;
  location?: string;
  /** Where Stripe's card page sends the customer back to if they cancel */
  cancelPath: string;
  /** Label for scan analytics when a payment attempt breaks */
  reportCode: string;
  /** The server says an item sold out or changed: the page should reload its data */
  onConflict?: () => void;
  disabled?: boolean;
};

/**
 * Pay for in-shop items: Apple Pay / Google Pay / Link right on the page when the phone has them (no redirect,
 * one Face ID), plus a card button that goes through Stripe Checkout. Without Stripe's public key or a wallet on
 * the device it is just the card button.
 */
export default function InShopPayButtons(props: Props) {
  const [walletReady, setWalletReady] = useState(false);
  const stripe = getStripe();
  const total = `$${(props.amountCents / 100).toFixed(2)}`;

  return (
    <div className="space-y-2" data-testid="in-shop-pay">
      {stripe && props.amountCents > 0 && (
        <Elements
          stripe={stripe}
          options={{
            mode: "payment",
            amount: props.amountCents,
            currency: "usd",
            appearance: { theme: "stripe", variables: { borderRadius: "12px" } },
          }}
        >
          <WalletButtons {...props} onAvailable={setWalletReady} />
        </Elements>
      )}
      <CardButton {...props} label={walletReady ? `Pay with card · ${total}` : `Buy now · ${total}`} secondary={walletReady} />
    </div>
  );
}

function WalletButtons({ items, location, reportCode, onConflict, disabled, onAvailable }: Props & { onAvailable: (available: boolean) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const handleConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) return;
    const fail = (message: string, detail: string) => {
      event.paymentFailed({ reason: "fail" });
      reportScanFailure(reportCode, "buy-failed", detail, location);
      toast.error(message);
    };
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) return fail(submitError.message || "Something went wrong. Please try again.", "wallet-submit");

      // The order and the PaymentIntent are created only now, when the customer has approved the wallet sheet
      const res = await fetch("/api/in-shop/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          location,
          email: event.billingDetails?.email,
          name: event.billingDetails?.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        fail(data.error || "Sorry, this book just sold out.", "sold-out-race");
        onConflict?.();
        return;
      }
      if (!res.ok || !data.clientSecret) return fail(data.error || "Could not start the payment. Please try again.", "wallet-intent");

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: { return_url: `${window.location.origin}/receipt?orderId=${data.orderId}` },
        redirect: "if_required",
      });
      if (error || !paymentIntent) return fail(error?.message || "The payment didn't go through. Please try again.", "wallet-confirm");

      router.push(`/receipt?orderId=${encodeURIComponent(data.orderId)}&payment_intent=${encodeURIComponent(paymentIntent.id)}`);
    } catch {
      fail("Something went wrong. Please try again.", "network");
    }
  };

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : undefined} data-testid="wallet-buttons">
      <ExpressCheckoutElement
        options={{
          buttonHeight: 48,
          buttonType: { applePay: "buy", googlePay: "buy" },
          emailRequired: true,
          paymentMethods: { applePay: "auto", googlePay: "auto", link: "auto", amazonPay: "never", paypal: "never" },
          layout: { maxColumns: 1, maxRows: 2 },
        }}
        onReady={({ availablePaymentMethods }) => onAvailable(!!availablePaymentMethods)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

function CardButton({ items, location, cancelPath, reportCode, onConflict, disabled, label, secondary }: Props & { label: string; secondary: boolean }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    let navigating = false;
    // What to record if something throws: a failed fetch (no connection) counts as "network"
    let failure: "network" | "checkout-failed" = "network";
    try {
      // One request creates the order and the Stripe session, so the phone makes a single round trip
      const res = await fetch("/api/in-shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, location, cancelPath }),
      });
      const data = await res.json();
      if (res.status === 409) {
        // Someone bought the last copy since this page loaded
        toast.error(data.error || "Sorry, this book just sold out.");
        reportScanFailure(reportCode, "buy-failed", "sold-out-race", location);
        onConflict?.();
        return;
      }
      if (!data.url) {
        failure = "checkout-failed";
        throw new Error(data.error || "Failed to start checkout");
      }
      navigating = true;
      window.location.href = data.url;
    } catch (e) {
      reportScanFailure(reportCode, "buy-failed", failure, location);
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      // Stay disabled while navigating to Stripe; on any failure the button must work again
      if (!navigating) setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy || disabled}
      data-testid="scan-buy-now"
      className={
        secondary
          ? "w-full block px-6 py-3 rounded-xl font-semibold text-gray-800 border border-gray-300 bg-white disabled:opacity-60"
          : "w-full block px-6 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 disabled:opacity-60"
      }
    >
      {busy ? "Opening checkout…" : label}
    </button>
  );
}
