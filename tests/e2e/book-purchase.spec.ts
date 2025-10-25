import { test, expect } from '../fixtures/base-test';
import { generateTestEmail } from '../fixtures/test-data';
import { 
  initializeAPIHelper, 
  setupCartViaLocalStorage,
  waitForCheckoutNavigation 
} from '../helpers/test-workflows.helper';
import type { APIHelper } from '../helpers/api.helper';

/**
 * End-to-End Test: Book Purchase Flow
 * 
 * This test suite covers critical purchase flow scenarios:
 * 1. Email validation (negative test) - OPTIMIZED: Uses localStorage for speed
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

  test('should show email validation error when email is missing', async ({ cartPage, page }) => {
    // Fast setup: Add to cart via localStorage instead of UI
    await setupCartViaLocalStorage(page, cartPage, [testBook]);

    await cartPage.selectShipping();
    await cartPage.clickCheckout();

    // Wait for and verify email validation error
    await cartPage.page.locator('text="Email is required."').waitFor({ state: 'visible', timeout: 3000 });
    expect(await cartPage.isEmailErrorVisible()).toBe(true);
  });

  test('should proceed to checkout with valid email and shipping', async ({ cartPage, page }) => {
    // Fast setup: Add to cart via localStorage instead of UI
    await setupCartViaLocalStorage(page, cartPage, [testBook]);

    const testEmail = generateTestEmail();
    await cartPage.enterEmail(testEmail);
    await cartPage.selectShipping();

    await cartPage.clickCheckout();
    await waitForCheckoutNavigation(page);

    expect(page.url()).not.toContain('/cart');
  });

  test('should complete full purchase flow from search to checkout', async ({ 
    homePage, 
    cartPage, 
    page 
  }) => {
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

