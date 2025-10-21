import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Home Page Object Model
 * 
 * Represents the home page with search and book browsing functionality
 */
export class HomePage extends BasePage {
  // Locators
  readonly searchInput: Locator;
  readonly searchClearButton: Locator;
  readonly cartIcon: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByTestId('search-input');
    this.searchClearButton = page.getByTestId('search-clear-button');
    this.cartIcon = page.getByTestId('cart-icon');
  }

  /**
   * Navigate to home page
   */
  async navigate() {
    await this.goto('/');
    await this.waitForPageLoad();
  }

  /**
   * Search for a book
   */
  async searchForBook(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    // Wait for search to complete - using shorter wait for better performance
    await this.page.waitForLoadState('load');
  }

  /**
   * Type in search input without submitting
   */
  async typeInSearch(query: string) {
    // Clear the input first
    await this.searchInput.clear();
    // Use type() instead of fill() to trigger onChange events
    await this.searchInput.type(query);
  }

  /**
   * Clear search input
   */
  async clearSearch() {
    // Wait for clear button to be visible (it only appears when there's text)
    await this.searchClearButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.searchClearButton.click();
  }

  /**
   * Get book card by book ID
   */
  getBookCard(bookId: string): Locator {
    return this.page.getByTestId(`book-card-${bookId}`);
  }

  /**
   * Get book title element by book ID
   */
  getBookTitle(bookId: string): Locator {
    return this.page.getByTestId(`book-title-${bookId}`);
  }

  /**
   * Get add to cart button for a specific book
   */
  getAddToCartButton(bookId: string): Locator {
    return this.page.getByTestId(`add-to-cart-button-${bookId}`);
  }

  /**
   * Add a book to cart by book ID
   */
  async addBookToCart(bookId: string) {
    const addToCartButton = this.getAddToCartButton(bookId);
    await addToCartButton.click();
    // Wait for "Added to cart!" toast - this already includes sufficient wait time
    await this.waitForToast('Added to cart!');
  }

  /**
   * Click on a book card to view details
   */
  async viewBookDetails(bookId: string) {
    const bookCard = this.getBookCard(bookId);
    await bookCard.click();
    await this.waitForPageLoad();
  }

  /**
   * Navigate to cart
   */
  async goToCart() {
    await this.cartIcon.click();
    await this.waitForPageLoad();
  }

  /**
   * Check if a book is visible on the page
   */
  async isBookVisible(bookId: string): Promise<boolean> {
    const bookCard = this.getBookCard(bookId);
    return bookCard.isVisible();
  }

  /**
   * Get the count of visible books
   */
  async getVisibleBooksCount(): Promise<number> {
    const bookCards = this.page.locator('[data-testid^="book-card-"]');
    return bookCards.count();
  }

  /**
   * Get all visible book IDs
   */
  async getVisibleBookIds(): Promise<string[]> {
    const bookCards = this.page.locator('[data-testid^="book-card-"]');
    const count = await bookCards.count();
    const ids: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const testId = await bookCards.nth(i).getAttribute('data-testid');
      if (testId) {
        const id = testId.replace('book-card-', '');
        ids.push(id);
      }
    }
    
    return ids;
  }

  /**
   * Wait for books to load
   */
  async waitForBooksToLoad() {
    await this.page.waitForSelector('[data-testid^="book-card-"]', { state: 'visible' });
  }
}

