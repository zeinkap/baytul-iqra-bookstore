import { execFileSync } from 'child_process';
import http from 'http';
import { stripe, stripeTestMode } from './money-path.helper';
import { EMAIL_STUB_PORT } from './server-env';

/**
 * Pays a real Stripe TEST-mode Checkout Session with the Stripe CLI (`stripe trigger`), and captures the emails the
 * test server would send. Stripe has no API to pay a Checkout Session, so the CLI is the only way to get a paid one.
 */

export const stripeCliAvailable = (() => {
  try {
    execFileSync('stripe', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Creates and pays a test-mode session whose metadata points at `orderId`, and returns the paid session.
 * The CLI's own fixture decides the line items (2 x $15) and the buyer (Jenny Rosen, stripe@example.com).
 * Always runs with the app's sk_test_ key: never the CLI's live-mode login.
 */
export async function payOrderWithStripeCli(orderId: string, extraMetadata: Record<string, string> = {}) {
  if (!stripeTestMode) throw new Error('Refusing to run the Stripe CLI without a test-mode key');
  const metadata = { orderId, source: 'in-shop', fulfillmentType: 'pickup', pickupLocation: 'In shop', ...extraMetadata };
  const args = ['trigger', 'checkout.session.completed', '--api-key', process.env.STRIPE_SECRET_KEY!];
  for (const [key, value] of Object.entries(metadata)) args.push('--add', `checkout_session:metadata[${key}]=${value}`);
  execFileSync('stripe', args, { stdio: 'ignore', timeout: 90_000 });

  // The CLI doesn't print the session id: find it by the order id in its metadata
  const recent = await stripe.checkout.sessions.list({ limit: 20 });
  const session = recent.data.find((s) => s.metadata?.orderId === orderId);
  if (!session) throw new Error(`Stripe CLI session for order ${orderId} not found`);
  return stripe.checkout.sessions.retrieve(session.id);
}

export type CapturedEmail = { to: string[]; subject: string };

/** A tiny stand-in for the Resend API that records what the test server tries to send. */
export class EmailStub {
  emails: CapturedEmail[] = [];
  private server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        this.emails.push({ to: [parsed.to].flat(), subject: String(parsed.subject ?? '') });
      } catch {
        // not JSON: ignore
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'stub-email-id' }));
    });
  });

  start() {
    return new Promise<void>((resolve) => this.server.listen(EMAIL_STUB_PORT, resolve));
  }
  stop() {
    return new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
  clear() {
    this.emails = [];
  }
  /** Emails for one recipient, optionally only those whose subject contains `text`. */
  to(address: string, text = '') {
    return this.emails.filter((e) => e.to.includes(address) && e.subject.includes(text));
  }
  /** Waits until at least `count` matching emails arrived (they are sent after the response), then returns them. */
  async waitFor(address: string, text: string, count = 1, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.to(address, text).length >= count) return this.to(address, text);
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Expected ${count} email(s) to ${address} matching "${text}", got ${this.to(address, text).length}: ${JSON.stringify(this.emails)}`);
  }
  /** Gives late emails time to show up, so "nothing was sent" assertions mean something. */
  settle(ms = 2000) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }
}
