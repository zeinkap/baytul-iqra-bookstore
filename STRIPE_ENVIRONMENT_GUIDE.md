# Stripe Environment Configuration

## Understanding Stripe's Test Mode vs Live Mode

Stripe doesn't use a traditional "sandbox" - instead, every account has **two complete environments** that you toggle between:

| Feature | Test Mode 🧪 | Live Mode 💰 |
|---------|-------------|-------------|
| **Purpose** | Development & Testing | Production |
| **API Keys** | `pk_test_...`, `sk_test_...` | `pk_live_...`, `sk_live_...` |
| **Credit Cards** | Test cards only (4242...) | Real cards only |
| **Money** | Fake (no real charges) | Real transactions |
| **Dashboard** | Separate test data | Real customer data |
| **Webhooks** | Test webhook endpoints | Live webhook endpoints |
| **Use For** | Local dev, staging, testing | Production website |

---

## Your Configuration

### Local Development (.env file)
```bash
# Use TEST mode keys for local development
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_YOUR_KEY"
STRIPE_SECRET_KEY="sk_test_YOUR_KEY"
STRIPE_WEBHOOK_SECRET="whsec_YOUR_TEST_WEBHOOK"
```

### Production (Vercel Environment Variables)
```bash
# Use LIVE mode keys for production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_YOUR_KEY"
STRIPE_SECRET_KEY="sk_live_YOUR_KEY"
STRIPE_WEBHOOK_SECRET="whsec_YOUR_LIVE_WEBHOOK"
```

---

## How to Get Your Keys

### For Local Development (Test Keys):

1. **Go to Stripe Dashboard**
   ```
   https://dashboard.stripe.com
   ```

2. **Toggle to Test Mode**
   - Look at top-left corner
   - Click the switch to enable "Test mode"
   - You should see an orange "TEST DATA" banner

3. **Get Test API Keys**
   - Navigate: **Developers** → **API keys**
   - Copy your keys:
     - **Publishable key**: Starts with `pk_test_`
     - **Secret key**: Starts with `sk_test_` (click "Reveal test key")

4. **Set Up Test Webhooks**
   
   **Option A: Stripe CLI (Recommended for Local)**
   ```bash
   # Install Stripe CLI
   brew install stripe/stripe-brew/stripe
   
   # Login to Stripe
   stripe login
   
   # Forward webhooks to local server
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   
   # Copy the signing secret (whsec_...) it displays
   ```
   
   **Option B: Create Test Webhook Endpoint**
   - Navigate: **Developers** → **Webhooks** (in test mode)
   - Click "Add endpoint"
   - Endpoint URL: Your test server URL
   - Select events: `checkout.session.completed`
   - Copy the **Signing secret**

### For Production (Live Keys):

1. **Toggle to Live Mode**
   - Click the "Test mode" switch to turn it OFF
   - Orange banner disappears

2. **Get Live API Keys**
   - Navigate: **Developers** → **API keys**
   - Copy your keys:
     - **Publishable key**: Starts with `pk_live_`
     - **Secret key**: Starts with `sk_live_` (click "Reveal live key")

3. **⚠️ IMPORTANT**: Never put live keys in code or .env files!
   - Add them to Vercel environment variables only
   - Keep them secret and secure

4. **Set Up Live Webhooks**
   - Navigate: **Developers** → **Webhooks** (in live mode)
   - Click "Add endpoint"
   - Endpoint URL: `https://www.baytuliqra.com/api/stripe/webhook`
   - Select events: `checkout.session.completed`
   - Copy the **Signing secret** → Add to Vercel env vars

---

## Test Mode Features

### Test Credit Cards

Stripe provides test cards for different scenarios:

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Card declined |
| `4000 0027 6000 3184` | Requires authentication (3D Secure) |
| `4000 0000 0000 0069` | Charge expires |
| `4000 0000 0000 0341` | Charge fails after authentication |

**For all test cards:**
- Expiration: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

### What You Can Test

In Test Mode, you can safely test:
- ✅ Complete checkout flows
- ✅ Payment processing
- ✅ Webhooks
- ✅ Refunds
- ✅ Subscriptions
- ✅ Payment Links
- ✅ All Stripe features

**Without:**
- ❌ Charging real money
- ❌ Affecting production data
- ❌ Risk of errors with customers

---

## Visual Guide: Toggle Between Modes

### Test Mode (Development)
```
┌─────────────────────────────────────────┐
│ 🔵 Test mode    [Toggle OFF]     ⚙️    │ ← Orange banner
│─────────────────────────────────────────│
│ Dashboard                                │
│                                          │
│ Recent payments: [TEST DATA badges]     │
└─────────────────────────────────────────┘
```

### Live Mode (Production)
```
┌─────────────────────────────────────────┐
│ Dashboard                    ⚙️          │ ← No test banner
│─────────────────────────────────────────│
│                                          │
│ Recent payments: [REAL transactions]    │
└─────────────────────────────────────────┘
```

---

## Common Questions

### Q: Do I need a separate Stripe account for testing?
**A:** No! Test Mode is built into every Stripe account.

### Q: Can I switch between Test and Live mode anytime?
**A:** Yes! Just toggle the switch in the dashboard. Your data in each mode is completely separate.

### Q: What happens if I accidentally use live keys locally?
**A:** Real transactions will be created! Always use test keys for development.

### Q: How do I know which mode I'm in?
**A:** 
- **Test Mode**: Orange "TEST DATA" banner, keys start with `_test_`
- **Live Mode**: No banner, keys start with `_live_`

### Q: Can test transactions affect my live dashboard?
**A:** No! Test and Live modes are completely isolated.

### Q: Do I get charged for test transactions?
**A:** No! Test mode is completely free.

---

## Best Practices

✅ **Always use Test Mode for:**
- Local development
- Staging environments
- Automated tests (like Playwright)
- Learning/experimenting
- Feature development

✅ **Only use Live Mode for:**
- Production website
- Real customer transactions
- When ready to accept real payments

❌ **Never:**
- Use live keys in local development
- Commit Stripe keys to git
- Share your secret keys
- Mix test and live data

---

## Verification Checklist

Before deploying to production, verify:

- [ ] Local `.env` has `pk_test_` and `sk_test_` keys
- [ ] Vercel has `pk_live_` and `sk_live_` keys
- [ ] `.env` and `.env.production` are in `.gitignore`
- [ ] Test webhooks working locally (Stripe CLI)
- [ ] Live webhooks configured in Stripe dashboard
- [ ] Can complete test checkout with 4242... card
- [ ] Never committed secret keys to git

---

## Resources

- [Stripe Test Mode Documentation](https://stripe.com/docs/testing)
- [Test Card Numbers](https://stripe.com/docs/testing#cards)
- [Stripe CLI Guide](https://stripe.com/docs/stripe-cli)
- [Webhooks Documentation](https://stripe.com/docs/webhooks)

