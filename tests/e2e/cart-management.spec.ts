import { test, expect } from '../fixtures/base-test';
import { 
  initializeAPIHelper, 
  addBookToCart,
  addMultipleBooksToCart,
  setupCartViaLocalStorage
} from '../helpers/test-workflows.helper';
import type { APIHelper } from '../helpers/api.helper';

/**
 * End-to-End Test: Cart Management
 * 
 * Tests critical cart operations:
 * 1. Adding multiple books and verifying titles (uses UI - tests add-to-cart flow)
 * 2. Removing books (OPTIMIZED: uses localStorage for faster setup)
 * 3. Cart persistence across navigation (uses UI - tests persistence after UI interaction)
 */

test.describe('Cart Management', () => {
  let apiHelper: APIHelper;

  test.beforeEach(async ({ page }) => {
    apiHelper = initializeAPIHelper(page);
  });

  test('should add multiple books and display correct titles', async ({ homePage, cartPage }) => {
    const books = await apiHelper.findMultipleInStockBooks(2);

    await addMultipleBooksToCart(homePage, books);
    await homePage.goToCart();

    expect(await cartPage.getCartItemCount()).toBe(2);

    const cartTitles = await cartPage.getCartBookTitles();
    expect(cartTitles).toContain(books[0].title);
    expect(cartTitles).toContain(books[1].title);
  });

  test('should remove book from cart and show empty state', async ({ cartPage, page }) => {
    const testBook = await apiHelper.findInStockBook();

    // Fast setup: Add to cart via localStorage instead of UI
    await setupCartViaLocalStorage(page, cartPage, [testBook]);

    await cartPage.removeItem(0);

    expect(await cartPage.isCartEmpty()).toBe(true);
  });

  test('should persist cart items on page navigation', async ({ homePage, cartPage }) => {
    const testBook = await apiHelper.findInStockBook();

    await addBookToCart(homePage, testBook);

    // Navigate away and back
    await cartPage.navigate();
    await homePage.navigate();
    await homePage.goToCart();

    expect(await cartPage.isCartEmpty()).toBe(false);
  });
});

