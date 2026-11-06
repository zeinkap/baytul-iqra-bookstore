import { test, expect } from '../fixtures/base-test';
import { initializeAPIHelper } from '../helpers/test-workflows.helper';
import type { APIHelper } from '../helpers/api.helper';

/**
 * End-to-End Test: Book Detail Page
 * 
 * This test suite covers book detail page scenarios:
 * 1. User can add book to cart from book details page
 * 2. Out of stock books cannot be added to cart
 */

test.describe('Book Detail Page', () => {
  let apiHelper: APIHelper;

  test.beforeEach(async ({ page }) => {
    apiHelper = initializeAPIHelper(page);
  });

  test('TC-011: adding an in-stock book from its detail page puts that book in the cart', async ({ 
    bookDetailPage,
    cartPage 
  }) => {
    // Find a book that's in stock
    const testBook = await apiHelper.findInStockBook();

    // Navigate directly to the book detail page
    await bookDetailPage.navigate(testBook.id);

    // Verify the book title is displayed
    const displayedTitle = await bookDetailPage.getBookTitle();
    expect(displayedTitle).toContain(testBook.title);

    // Add book to cart from detail page
    await bookDetailPage.addToCart();

    // Navigate to cart
    await bookDetailPage.goToCart();

    // Verify cart has the book
    expect(await cartPage.isCartEmpty()).toBe(false);
    const cartTitles = await cartPage.getCartBookTitles();
    expect(cartTitles).toContain(testBook.title);
  });

  test('TC-012: an out-of-stock book detail page shows it as out of stock and disables Add to cart', async ({ bookDetailPage }) => {
    // Find a book that's out of stock
    let outOfStockBook;
    try {
      outOfStockBook = await apiHelper.findOutOfStockBook();
    } catch {
      // If no out-of-stock books exist, skip this test
      test.skip(true, 'No out-of-stock books available for testing');
      return;
    }

    // Navigate directly to the out of stock book detail page
    await bookDetailPage.navigate(outOfStockBook.id);

    // Verify the book title is displayed
    const displayedTitle = await bookDetailPage.getBookTitle();
    expect(displayedTitle).toContain(outOfStockBook.title);

    // Verify the out of stock message/button is displayed
    const isOutOfStock = await bookDetailPage.isOutOfStock();
    expect(isOutOfStock).toBe(true);

    // Verify the add to cart button is not clickable
    // The button should be disabled or show "Out of Stock"
    const addButton = bookDetailPage.addToCartButton;
    const isDisabled = await addButton.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('TC-013: a book detail page shows the title, a dollar price and the author', async ({ bookDetailPage }) => {
    // Find a book that's in stock
    const testBook = await apiHelper.findInStockBook();

    // Navigate to book detail page
    await bookDetailPage.navigate(testBook.id);

    // Verify book title
    const displayedTitle = await bookDetailPage.getBookTitle();
    expect(displayedTitle).toBeTruthy();

    // Verify book price is displayed
    const displayedPrice = await bookDetailPage.getBookPrice();
    expect(displayedPrice).toMatch(/\$\d+\.\d{2}/);

    // Verify author is displayed (if available)
    const displayedAuthor = await bookDetailPage.getBookAuthor();
    expect(displayedAuthor).toBeTruthy();
  });
});

