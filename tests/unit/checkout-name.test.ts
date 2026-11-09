import { describe, it, expect } from 'vitest';
import { nameFromCustomFields } from '@/lib/checkoutName';

const field = (key: string, value: string | null) => ({ key, text: { value } }) as never;
const session = (...fields: unknown[]) => ({ custom_fields: fields }) as never;

/** The "Your name" field on the in-shop payment page. */
describe('Name from the Checkout custom fields', () => {
  it('TC-255: the name typed on the payment page is returned, trimmed', () => {
    expect(nameFromCustomFields(session(field('full_name', '  Amina Khan ')))).toBe('Amina Khan');
  });

  it('TC-256: a missing, empty or other field gives no name, so it cannot overwrite a name from elsewhere', () => {
    expect(nameFromCustomFields({ custom_fields: [] } as never)).toBeUndefined();
    expect(nameFromCustomFields({} as never)).toBeUndefined();
    expect(nameFromCustomFields(session(field('full_name', '   ')))).toBeUndefined();
    expect(nameFromCustomFields(session(field('full_name', null)))).toBeUndefined();
    expect(nameFromCustomFields(session(field('something_else', 'x')))).toBeUndefined();
  });
});
