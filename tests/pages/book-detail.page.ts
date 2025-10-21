import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Book Detail Page Object Model
 * 
 * Represents the individual book details page
 */
export class BookDetailPage extends BasePage {
  // Locators
  readonly bookTitle: Locator;
  readonly bookAuthor: Locator;
  readonly bookPrice: Locator;
  readonly addToCartButton: Locator;
  readonly cartIcon: Locator;

  constructor(page: Page) {
    super(page);
    this.bookTitle = page.locator('h1').first();
    this.bookAuthor = page.locator('text=/by .*/').first();
    this.bookPrice = page.locator('text=/\\$\\d+\\.\\d{2}/').first();
    this.cartIcon = page.getByTestId('cart-icon');
    // Add to cart button will have a dynamic test-id
    this.addToCartButton = page.locator('[data-testid^="add-to-cart-button-"]').first();
  }

  /**
   * Navigate to book detail page by ID
   */
  async navigate(bookId: string) {
    await this.goto(`/books/${bookId}`);
    await this.waitForPageLoad();
  }

  /**
   * Get book title text
   */
  async getBookTitle(): Promise<string> {
    const title = await this.bookTitle.textContent();
    return title || '';
  }

  /**
   * Get book author text
   */
  async getBookAuthor(): Promise<string> {
    const authorText = await this.bookAuthor.textContent() || '';
    return authorText.replace('by ', '').trim();
  }

  /**
   * Get book price
   */
  async getBookPrice(): Promise<string> {
    const price = await this.bookPrice.textContent();
    return price || '';
  }

  /**
   * Add book to cart
   */
  async addToCart() {
    await this.addToCartButton.click();
    await this.waitForToast('Added to cart!');
  }

  /**
   * Navigate to cart
   */
  async goToCart() {
    await this.cartIcon.click();
    await this.waitForPageLoad();
  }

  /**
   * Check if book is out of stock
   */
  async isOutOfStock(): Promise<boolean> {
    const outOfStockButton = this.page.locator('button:has-text("Out of Stock")');
    return outOfStockButton.isVisible();
  }
}

