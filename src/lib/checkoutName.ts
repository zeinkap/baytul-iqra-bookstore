import type Stripe from 'stripe';

/**
 * In-shop Checkout skips billing-address collection to stay short, and then Stripe does not reliably report the
 * customer's name. A required one-line "Your name" field on the payment page makes sure every paid order has it.
 */
export const NAME_FIELD_KEY = 'full_name';

export const NAME_CUSTOM_FIELD: Stripe.Checkout.SessionCreateParams.CustomField = {
  key: NAME_FIELD_KEY,
  label: { type: 'custom', custom: 'Your name' },
  type: 'text',
  optional: false,
  text: { minimum_length: 2, maximum_length: 100 },
};

/** The name typed into the "Your name" field of a Checkout Session, if there is one. */
export function nameFromCustomFields(session: Pick<Stripe.Checkout.Session, 'custom_fields'>): string | undefined {
  const value = session.custom_fields?.find((field) => field.key === NAME_FIELD_KEY)?.text?.value;
  return value?.trim() || undefined;
}
