import { Page } from '@playwright/test';
import { HomePage } from '../pages/home.page';
import { CartPage } from '../pages/cart.page';
import { APIHelper } from './api.helper';

/**
 * Common test workflows used across E2E tests
 * 
 * These helpers encapsulate common user flows to reduce code duplication
 * and improve test maintainability.
 */

/**
 * Add a book to cart (full flow: navigate, search, add)
 */
export async function addBookToCart(
  homePage: HomePage,
  book: { id: string; title: string }
): Promise<void> {
  await homePage.navigate();
  await homePage.searchForBook(book.title);
  await homePage.addBookToCart(book.id);
}

/**
 * Add multiple books to cart
 */
export async function addMultipleBooksToCart(
  homePage: HomePage,
  books: Array<{ id: string; title: string }>
): Promise<void> {
  await homePage.navigate();
  
  for (const book of books) {
    await homePage.searchForBook(book.title);
    await homePage.addBookToCart(book.id);
  }
}

/**
 * Wait for navigation to checkout (Stripe or internal)
 */
export async function waitForCheckoutNavigation(page: Page, timeout = 30000): Promise<void> {
  await page.waitForURL(url => {
    const urlString = url.toString();
    return urlString.includes('checkout.stripe.com') || urlString.includes('/checkout');
  }, { timeout });
}

/**
 * Initialize API helper with base URL
 */
export function initializeAPIHelper(page: Page): APIHelper {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
  return new APIHelper(page.request, baseURL);
}

/**
 * Setup: Add book to cart and navigate to cart page
 */
export async function setupBookInCart(
  homePage: HomePage,
  cartPage: CartPage,
  book: { id: string; title: string }
): Promise<void> {
  await addBookToCart(homePage, book);
  await homePage.goToCart();
}

/**
 * Test data constants
 */
export const TEST_DATA = {
  INVALID_SEARCH_QUERY: 'XYZ_NONEXISTENT_BOOK_12345',
  PARTIAL_TITLE_LENGTH: 5,
} as const;

