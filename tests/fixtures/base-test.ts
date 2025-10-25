import { test as base } from '@playwright/test';
import { HomePage } from '../pages/home.page';
import { BookDetailPage } from '../pages/book-detail.page';
import { CartPage } from '../pages/cart.page';
import { CheckoutSuccessPage } from '../pages/checkout-success.page';
import { ContactPage } from '../pages/contact.page';

/**
 * Extended test fixture with Page Object Models
 * 
 * This fixture provides access to all page objects for each test.
 * Also includes route interception to prevent stock updates during tests.
 * 
 * Usage: test('my test', async ({ homePage, cartPage }) => { ... })
 */

type PageFixtures = {
  homePage: HomePage;
  bookDetailPage: BookDetailPage;
  cartPage: CartPage;
  checkoutSuccessPage: CheckoutSuccessPage;
  contactPage: ContactPage;
};

export const test = base.extend<PageFixtures>({
  // Extend the page fixture to add route interception
  page: async ({ page }, use) => {
    // Intercept stock update API calls and mock successful response
    // This prevents actual stock decrement during tests
    await page.route('**/api/orders/*/update-stock', async (route) => {
      console.log('🔵 [TEST] Intercepted stock update call - returning mock success');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          message: 'Stock update mocked for testing',
          stockUpdated: false // Indicate this was mocked
        })
      });
    });

    // Intercept Stripe webhook calls (in case they're triggered during tests)
    // We let them pass through but log for visibility
    await page.route('**/api/stripe/webhook**', async (route) => {
      console.log('🔵 [TEST] Intercepted Stripe webhook - allowing pass-through');
      // Continue the request but we've logged it
      await route.continue();
    });

    await use(page);
  },

  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(homePage);
  },

  bookDetailPage: async ({ page }, use) => {
    const bookDetailPage = new BookDetailPage(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(bookDetailPage);
  },

  cartPage: async ({ page }, use) => {
    const cartPage = new CartPage(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(cartPage);
  },

  checkoutSuccessPage: async ({ page }, use) => {
    const checkoutSuccessPage = new CheckoutSuccessPage(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(checkoutSuccessPage);
  },

  contactPage: async ({ page }, use) => {
    const contactPage = new ContactPage(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(contactPage);
  },
});

export { expect } from '@playwright/test';

