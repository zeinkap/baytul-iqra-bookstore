# In-shop basket and Apple Pay / Google Pay on the scan page

Customers who scan a book's QR sticker can pay right on the page with Apple Pay, Google Pay or Link (one tap, no
redirect), or by card through Stripe Checkout. They can also add several books to a basket and pay once.

## How it works

1. `/b/<code>`: the scan page. With an empty basket it shows the pay buttons for that book. Once the basket has
   books, scanning offers **Add to basket** and a link to the basket instead, so one tap never pays for only part of it.
2. `/basket`: the books scanned so far (kept in the browser's localStorage for 3 hours; prices and stock are
   re-read from `POST /api/in-shop/quote`), with the same pay buttons for the whole basket.
3. Wallet payment (`src/components/InShopPayButtons.tsx`): Stripe's Express Checkout Element. When the customer
   approves the wallet sheet, `POST /api/in-shop/payment-intent` creates the unpaid in-shop order and a
   PaymentIntent (prices come from the database), then Stripe confirms the payment and the page opens
   `/receipt?orderId=…&payment_intent=pi_…`.
4. Finishing the order (`finalizeInShopIntent` in `src/lib/finalizeOrder.ts`) happens from two places, whichever is
   first: the `payment_intent.succeeded` webhook, and the receipt page calling `POST /api/in-shop/confirm-payment`.
   It marks the order paid, saves the wallet's name and email, sends the receipt email and takes the stock, once.
5. Card button: unchanged, `POST /api/in-shop/buy` creates a Stripe Checkout session.
6. Refunds: `charge.refunded` finds the order from the PaymentIntent's metadata, so refunds of wallet payments are
   recorded and the customer gets the refund email like any other.

Without `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, or on a phone/browser with no wallet set up, the pay area is just the
card button.

## One-time Stripe setup

- Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (the `pk_live_…` key) in the Vercel project, and redeploy.
- **Apple Pay:** register the site's domain in Stripe Dashboard → Settings → Payment method domains
  (`www.baytuliqra.com`, and `baytuliqra.com` if it serves pages). Apple Pay does not show on unregistered domains,
  so it will not appear on Vercel preview URLs. Google Pay and Link do not need this.
- **Webhook:** the endpoint for `/api/stripe/webhook` must receive `payment_intent.succeeded` (besides
  `checkout.session.completed` and `charge.refunded`). If it doesn't, an order is only finished when the customer's
  phone reaches the receipt page.
- Stripe's own customer emails (successful payments, refunds) stay off: PaymentIntents here carry the email in
  metadata, not `receipt_email`, so Stripe sends nothing and the shop's emails are the only ones.

## Trying it

Use a Stripe **test** key in a preview/dev deploy, a phone with a card in Google Pay (or Apple Pay on a registered
domain), and a Stripe test card in the wallet. Check: the sheet shows the right total, the receipt turns green
within about a second, the sale alert and receipt email arrive once, and stock drops by the quantity bought.
