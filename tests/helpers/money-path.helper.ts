import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';

/**
 * Helpers for the money-path API tests (in-shop buy, Stripe webhook, stock, promo codes).
 *
 * These tests create their own books, promo codes and orders directly in the database, so they never
 * touch the real catalog, and delete them afterwards. For that reason they only run against a local
 * database: if DATABASE_URL points anywhere else, `localDbAvailable` is false and the specs skip.
 * Anything that calls Stripe uses test mode only (`stripeTestMode`) and never sends the shop an email.
 */

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the environment
}

const dbUrl = process.env.DATABASE_URL ?? '';
export const localDbAvailable = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(dbUrl);
export const stripeTestMode = (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_');
export const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

export const db = new PrismaClient();
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_missing');

/** Creates and later removes the rows one spec file needs. */
export class Fixtures {
  private bookIds: string[] = [];
  private promoIds: string[] = [];
  private orderIds: string[] = [];

  async book(opts: { stock?: number; price?: number } = {}) {
    const book = await db.book.create({
      data: {
        title: `E2E TEST BOOK ${randomUUID()}`,
        author: 'E2E Test',
        description: 'Created by an automated test',
        price: opts.price ?? 20,
        images: [],
        stock: opts.stock ?? 5,
      },
    });
    this.bookIds.push(book.id);
    return book;
  }

  async promo(data: {
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minimumOrderAmount?: number;
    maxUses?: number;
    currentUses?: number;
    validFrom?: Date;
    validUntil?: Date;
    isActive?: boolean;
  }) {
    const promo = await db.promoCode.create({
      data: { code: `E2E${randomUUID().slice(0, 8).toUpperCase()}`, description: 'E2E test code', ...data },
    });
    this.promoIds.push(promo.id);
    return promo;
  }

  /** Tracks an order created through the API so it is removed afterwards. */
  trackOrder(id: string) {
    this.orderIds.push(id);
  }

  async order(book: { id: string; title: string; price: number }, opts: { quantity?: number; paid?: boolean } = {}) {
    const quantity = opts.quantity ?? 1;
    const order = await db.order.create({
      data: {
        items: [{ id: book.id, title: book.title, price: book.price, quantity }],
        total: book.price * quantity,
        finalTotal: book.price * quantity,
        fulfillmentType: 'pickup',
        pickupLocation: 'In shop',
        source: 'in-shop',
        // Already-paid orders make the webhook skip the shop's sale-alert email, which must never fire from tests
        paidAt: opts.paid ? new Date() : null,
      },
    });
    this.orderIds.push(order.id);
    return order;
  }

  async cleanup() {
    await db.order.deleteMany({ where: { id: { in: this.orderIds } } });
    await db.promoCode.deleteMany({ where: { id: { in: this.promoIds } } });
    await db.book.deleteMany({ where: { id: { in: this.bookIds } } });
  }
}

export async function disconnect() {
  await db.$disconnect();
}

/** A checkout.session.completed payload signed the way Stripe signs it. */
export function signedEvent(
  type: string,
  object: Record<string, unknown>,
  opts: { secret?: string; timestamp?: number; tamper?: boolean } = {}
) {
  const payload = JSON.stringify({
    id: `evt_e2e_${randomUUID()}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object },
  });
  const header = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: opts.secret ?? webhookSecret,
    timestamp: opts.timestamp,
  });
  return { payload: opts.tamper ? payload.replace('"object":"event"', '"object":"event ","x":1') : payload, header };
}

/** The Stripe session id inside a hosted checkout URL (https://checkout.stripe.com/c/pay/cs_test_...#...). */
export function sessionIdFromUrl(url: string): string {
  const match = url.match(/cs_test_[A-Za-z0-9]+/);
  if (!match) throw new Error(`No Stripe test session id in ${url}`);
  return match[0];
}
