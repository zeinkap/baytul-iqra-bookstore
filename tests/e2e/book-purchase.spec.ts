import { test, expect } from '../fixtures/base-test';
import { generateTestEmail, testCustomer } from '../fixtures/test-data';
import { 
  initializeAPIHelper, 
  setupCartViaLocalStorage,
  waitForCheckoutNavigation 
} from '../helpers/test-workflows.helper';
import type { APIHelper } from '../helpers/api.helper';
import { stripeTestMode } from '../helpers/money-path.helper';

/**
 * End-to-End Test: Book Purchase Flow
 * 
 * This test suite covers critical purchase flow scenarios:
 * 1. Optional email: none is fine, a malformed one is rejected (negative test) - OPTIMIZED: Uses localStorage for speed
 * 2. Checkout with shipping (positive test) - OPTIMIZED: Uses localStorage for speed
 * 3. Complete purchase flow with pickup (comprehensive test) - Full UI flow to test entire journey
 */

test.describe('Book Purchase Flow', () => {
  let apiHelper: APIHelper;
  let testBook: { id: string; title: string; author: string; price: number };

  test.beforeEach(async ({ page }) => {
    apiHelper = initializeAPIHelper(page);
    testBook = await apiHelper.findInStockBook();
  });

  test('TC-034: checking out without an email is allowed and leaves the cart for the Stripe checkout page, which asks for it', async ({ cartPage, page }) => {
    test.skip(!stripeTestMode, 'creating a Stripe Checkout session needs a Stripe test key');
    await setupCartViaLocalStorage(page, cartPage, [testBook]);

    await cartPage.selectShipping();
    expect(await cartPage.emailInput.inputValue()).toBe('');
    await cartPage.clickCheckout();
    await waitForCheckoutNavigation(page);

    expect(page.url()).not.toContain('/cart');
  });

  test('TC-035: checking out with a malformed email shows "Please enter a valid email address." and stays on the cart', async ({ cartPage, page }) => {
    await setupCartViaLocalStorage(page, cartPage, [testBook]);

    await cartPage.enterEmail(testCustomer.invalidEmail);
    await cartPage.selectShipping();
    await cartPage.clickCheckout();

    await page.locator('text="Please enter a valid email address."').first().waitFor({ state: 'visible', timeout: 3000 });
    expect(await cartPage.isEmailErrorVisible()).toBe(true);
    expect(page.url()).toContain('/cart');
  });

  test('TC-036: checking out with a valid email and shipping leaves the cart for the Stripe checkout page', async ({ cartPage, page }) => {
    test.skip(!stripeTestMode, 'creating a Stripe Checkout session needs a Stripe test key');
    // Fast setup: Add to cart via localStorage instead of UI
    await setupCartViaLocalStorage(page, cartPage, [testBook]);

    const testEmail = generateTestEmail();
    await cartPage.enterEmail(testEmail);
    await cartPage.selectShipping();

    await cartPage.clickCheckout();
    await waitForCheckoutNavigation(page);

    expect(page.url()).not.toContain('/cart');
  });

  test('TC-037: searching for a book, adding it and checking out for pickup leaves the cart for the Stripe checkout page', async ({ 
    homePage, 
    cartPage, 
    page 
  }) => {
    test.skip(!stripeTestMode, 'creating a Stripe Checkout session needs a Stripe test key');
    // Search for book and verify it's visible
    await homePage.navigate();
    await homePage.searchForBook(testBook.title);
    expect(await homePage.isBookVisible(testBook.id)).toBe(true);

    // Add to cart and verify toast notification
    await homePage.addBookToCart(testBook.id);
    expect(await homePage.isToastVisible('Added to cart!')).toBe(true);

    // Navigate to cart and verify it has items
    await homePage.goToCart();
    expect(await cartPage.isCartEmpty()).toBe(false);

    // Complete checkout form with pickup
    const testEmail = generateTestEmail();
    await cartPage.enterEmail(testEmail);
    await cartPage.selectPickup();
    expect(await cartPage.emailInput.inputValue()).toBe(testEmail);

    // Proceed to checkout and verify navigation
    await cartPage.clickCheckout();
    await waitForCheckoutNavigation(page);
    expect(page.url()).not.toContain('/cart');
  });
});

