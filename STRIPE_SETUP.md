# Stripe Configuration Guide

## ⚠️ CRITICAL: Use Different Keys for Development vs Production

You should **NEVER** use the same Stripe keys in local development and production.

## Stripe Key Types

Stripe provides two complete sets of keys:

### Test Mode (Local Development)
- **Publishable Key**: `pk_test_...`
- **Secret Key**: `sk_test_...`
- **Webhook Secret**: `whsec_...` (from test webhook endpoint)

**Use these for:**
- Local development
- Testing checkout flows
- Development servers
- Playwright tests

**Benefits:**
- ✅ No real money charged
- ✅ Use test credit card numbers (4242 4242 4242 4242)
- ✅ Safe to experiment
- ✅ Separate dashboard from production

### Live Mode (Production Only)
- **Publishable Key**: `pk_live_...`
- **Secret Key**: `sk_live_...`
- **Webhook Secret**: `whsec_...` (from live webhook endpoint)

**Use these for:**
- Production deployments (Vercel/Render/etc.)
- Real customer transactions ONLY

**Risks if used locally:**
- ❌ Real credit cards get charged
- ❌ Real money transactions
- ❌ Production data mixed with test data
- ❌ Could affect real inventory

---

## How to Set Up Properly

### Step 1: Get Your Test Keys

1. Go to [Stripe Dashboard - Test Mode](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Publishable key** (starts with `pk_test_...`)
3. Copy your **Secret key** (starts with `sk_test_...`)

### Step 2: Get Test Webhook Secret

**Option A: Use Stripe CLI (Recommended for Local)**
```bash
# Install Stripe CLI
brew install stripe/stripe-brew/stripe  # macOS
# or download from: https://stripe.com/docs/stripe-cli

# Login to your Stripe account
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook signing secret (starts with whsec_...)
```

**Option B: Create Test Webhook Endpoint**
1. Go to [Stripe Dashboard - Test Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. URL: Your test URL (e.g., `https://your-test-domain.com/api/stripe/webhook`)
4. Select events: `checkout.session.completed`
5. Copy the **Signing secret**

### Step 3: Create Your Local .env File

Create a `.env` file in your project root (this file is gitignored):

```bash
# Database (Local PostgreSQL or SQLite)
DATABASE_URL="postgresql://username:password@localhost:5432/bookstore_dev"

# Stripe TEST Keys (for local development)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_YOUR_KEY_HERE"
STRIPE_SECRET_KEY="sk_test_YOUR_KEY_HERE"
STRIPE_WEBHOOK_SECRET="whsec_YOUR_WEBHOOK_SECRET_HERE"

# Admin Password
ADMIN_PASSWORD="your_local_admin_password"

# Base URL
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Email Service
RESEND_API_KEY="re_YOUR_RESEND_KEY"
```

### Step 4: Update Your .gitignore

**CRITICAL**: Add `.env.production` to `.gitignore` to prevent committing production secrets:

```bash
# Add to .gitignore
.env.production
```

### Step 5: Set Production Keys in Vercel/Hosting

**For Vercel:**
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add your **LIVE** keys:
   ```
   STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK_SECRET
   ```

**For Production Webhooks:**
1. Go to [Stripe Dashboard - Live Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://www.baytuliqra.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`
4. Copy the signing secret and add to Vercel environment variables

---

## Testing with Stripe Test Cards

When using test mode, use these card numbers:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Declined |
| `4000 0027 6000 3184` | Requires authentication (3D Secure) |

- **Expiry**: Any future date (e.g., 12/34)
- **CVC**: Any 3 digits (e.g., 123)
- **ZIP**: Any 5 digits (e.g., 12345)

---

## Current Issue: `.env.production` Staged with Live Keys

**Problem:** You have `.env.production` staged with LIVE Stripe keys, which should never be committed to git.

**Solution:**

```bash
# 1. Unstage the file
git restore --staged .env.production

# 2. Add to .gitignore
echo ".env.production" >> .gitignore

# 3. Commit the .gitignore change
git add .gitignore
git commit -m "chore: prevent .env.production from being committed"

# 4. Keep .env.production locally but never commit it
# (or delete it and use Vercel environment variables instead)
```

---

## Best Practices

✅ **DO:**
- Use test keys for all local development
- Use Stripe CLI for local webhook testing
- Set live keys as environment variables in your hosting platform
- Keep `.env` and `.env.production` in `.gitignore`
- Use different databases for dev and production

❌ **DON'T:**
- Never commit `.env` or `.env.production` files
- Never use live keys in local development
- Never share secret keys in code or documentation
- Never mix test and live transactions

---

## Verification

To verify you're in test mode, check your Stripe dashboard:
- Top left corner should show **"Test mode"** toggle
- All test transactions appear in test dashboard only
- Test keys start with `_test_` in the key name

---

## Questions?

- [Stripe Test Mode Documentation](https://stripe.com/docs/testing)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)

