import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import { paymentMethodInfo } from '@/lib/finalizeOrder';

const card = (billing: Partial<Stripe.PaymentMethod.BillingDetails>, wallet?: 'apple_pay') =>
  ({ type: 'card', card: { brand: 'visa', last4: '4242', wallet: wallet ? { type: wallet } : null }, billing_details: billing }) as unknown as Stripe.PaymentMethod;

/** What an order learns from the payment method Stripe charged. */
describe('Payment method info', () => {
  it('TC-250: the name and email on the card are returned, as a fallback when Checkout does not report customer details', () => {
    expect(paymentMethodInfo(card({ name: 'Amina Khan', email: 'amina@example.com' }))).toEqual({
      paymentMethod: 'card',
      paymentMethodDetail: 'Visa ending 4242',
      billingName: 'Amina Khan',
      billingEmail: 'amina@example.com',
    });
  });

  it('TC-251: empty or missing billing details come back as null, never as empty strings, so they cannot overwrite anything', () => {
    expect(paymentMethodInfo(card({ name: '', email: null }))).toMatchObject({ billingName: null, billingEmail: null });
    expect(paymentMethodInfo(null)).toEqual({ paymentMethod: null, paymentMethodDetail: null, billingName: null, billingEmail: null });
  });

  it('TC-252: a wallet payment still reports the wallet as the method', () => {
    expect(paymentMethodInfo(card({ name: 'A' }, 'apple_pay'))).toMatchObject({ paymentMethod: 'apple_pay', paymentMethodDetail: 'Apple Pay (Visa ending 4242)' });
  });
});
