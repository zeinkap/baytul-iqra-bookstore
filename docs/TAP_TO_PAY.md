# Tap to Pay (In-Person: Customer Taps Card on Your Phone)

This guide explains how to accept **in-person** payments where the customer taps their contactless card or phone on **your** phone.

---

## Option 1: Stripe Dashboard App (No Code) — **Recommended to start**

Use Stripe’s mobile app so you can accept tap-to-pay **without any custom app or code**.

### What you get

- Customer taps their card or phone on **your** iPhone or Android.
- No extra hardware; your phone is the reader.
- No development required.

### Steps

1. **Download the Stripe Dashboard app**
   - [iOS (App Store)](https://apps.apple.com/app/apple-store/id978516833)
   - [Android (Google Play)](https://play.google.com/store/apps/details?id=com.stripe.android.dashboard)

2. **Log in** with your Stripe account (the same one used by the bookstore).

3. **Enable NFC** on your phone (required for tap to pay).

4. **To take a payment**
   - Open the Stripe app → tap **+ (Add)** → **Charge a card or send an invoice**.
   - Enter the **amount** (e.g. the order total from your cart/admin).
   - Choose **Tap to Pay** and follow the on-screen instructions.
   - Have the customer tap their contactless card or phone on your device.

### Limitations

- The amount is entered **manually** in the app (no automatic link to a specific order in the bookstore).
- **Inventory is not updated** — the Stripe app does not talk to your bookstore. You’ll need to record the sale in your system yourself (e.g. create the order in admin or manually adjust stock) if you want inventory and order history to stay in sync.
- You’ll need to match payments to orders yourself (e.g. by amount and time, or by creating the order in your system and then entering that total in the app).

### Requirements and availability

- **iPhone:** iPhone XS or later, passcode set, signed into iCloud; see [Stripe’s docs](https://docs.stripe.com/no-code/tap-to-pay) for supported iOS versions.
- **Android:** A [supported Android device](https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay?platform=android#supported-devices).
- **Location** permissions enabled for the Stripe app.
- **Countries:** Supported in many regions (e.g. US, UK, Canada, Australia, much of Europe). See [Stripe Tap to Pay](https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay) for your country.

---

## Option 2: Integrated Flow (Custom Mobile App)

If you want the **exact order total** from the bookstore and automatic order linking when the customer pays on your phone, you need:

1. A **mobile app** (iOS/Android or React Native) that uses **Stripe Terminal** with **Tap to Pay**.
2. A **backend** that creates a Stripe **PaymentIntent** for that order; the app then collects the payment for that PaymentIntent.

### Backend (already available)

The project includes an API for Terminal/Tap to Pay so a future app can use it:

- **`POST /api/terminal/create-payment-intent`**
  - Body: `{ "orderId": "<existing-order-id>" }`
  - The order must already exist (e.g. created from the cart before “Pay in person”).
  - Returns: `{ "clientSecret", "paymentIntentId" }` for use with the Stripe Terminal SDK.

Your existing webhook already handles `payment_intent.succeeded`, so when the customer taps and pays, the same order is fulfilled and stock is updated.

### What you’d build

- A **native iOS or Android app**, or a **React Native** app, that:
  1. Gets the current in-person order (e.g. order ID from your site or a simple “in-person” flow).
  2. Calls `POST /api/terminal/create-payment-intent` with that `orderId`.
  3. Uses the **Stripe Terminal SDK** (e.g. [iOS](https://stripe.com/docs/terminal/payments/setup-reader/tap-to-pay?terminal-sdk-platform=ios), [Android](https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay?platform=android), or [React Native](https://www.npmjs.com/package/@stripe/stripe-terminal-react-native)) to collect a **card_present** payment for that PaymentIntent (Tap to Pay on your phone).

Stripe’s docs:

- [Tap to Pay setup](https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay)
- [Terminal integration overview](https://docs.stripe.com/terminal/designing-integration)

---

## Summary

| Goal | Approach |
|------|----------|
| **Start quickly, no dev work** | Use the **Stripe Dashboard mobile app** (Option 1). Enter amount manually, use Tap to Pay. (Inventory is **not** auto-updated.) |
| **Inventory auto-deduct + order record** | Use **Generate Payment Link** from your cart: create order → customer pays via link on their phone. Your webhook updates stock when payment succeeds. |
| **Exact order total + Tap to Pay on your phone + inventory** | Use **Option 2**: build a mobile app with Stripe Terminal Tap to Pay and `POST /api/terminal/create-payment-intent`; webhook updates stock. |

For most in-person sales, Option 1 is enough: create the order in the bookstore (or note the total), then in the Stripe app enter that amount and use Tap to Pay. If you need inventory to stay in sync, create the order in admin (or use the cart flow) and then either use the payment link for the customer to pay, or manually adjust stock after a Dashboard-app payment.
