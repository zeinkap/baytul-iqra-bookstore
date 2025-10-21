/**
 * Test data fixtures
 * 
 * Contains reusable test data for various test scenarios
 */

export const testBooks = {
  searchable: {
    title: 'The Sealed Nectar',
    author: 'Safiur Rahman',
    partialTitle: 'Sealed',
    partialAuthor: 'Safi'
  },
  outOfStock: {
    title: 'Out of Stock Book',
  }
};

export const testCustomer = {
  email: 'test-customer@example.com',
  invalidEmail: 'invalid-email',
};

export const testCheckout = {
  fulfillmentTypes: {
    shipping: 'shipping' as const,
    pickup: 'pickup' as const,
  },
  pickupLocation: 'Alpharetta, GA',
};

export const testPromoCodes = {
  valid: {
    code: 'TEST10',
    discountType: 'PERCENTAGE',
    discountValue: 10
  },
  invalid: {
    code: 'INVALID_CODE'
  }
};

/**
 * Get a unique test email address for test isolation
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Get a future date for testing expiry scenarios
 */
export function getFutureDate(daysFromNow: number = 30): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

/**
 * Get a past date for testing expiry scenarios
 */
export function getPastDate(daysAgo: number = 30): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

