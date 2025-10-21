import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Cart Page Object Model
 * 
 * Represents the shopping cart page with checkout functionality
 */
export class CartPage extends BasePage {
  // Locators
  readonly emailInput: Locator;
  readonly fulfillmentTypeShipping: Locator;
  readonly fulfillmentTypePickup: Locator;
  readonly promoCodeInput: Locator;
  readonly applyPromoCodeButton: Locator;
  readonly checkoutButton: Locator;
  readonly cartItemsContainer: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByTestId('cart-email-input');
    this.fulfillmentTypeShipping = page.getByTestId('fulfillment-type-shipping');
    this.fulfillmentTypePickup = page.getByTestId('fulfillment-type-pickup');
    this.promoCodeInput = page.getByTestId('promo-code-input');
    this.applyPromoCodeButton = page.getByTestId('apply-promo-code-button');
    this.checkoutButton = page.getByTestId('checkout-button');
    this.cartItemsContainer = page.locator('.lg\\:col-span-2').first();
  }

  /**
   * Navigate to cart page
   */
  async navigate() {
    await this.goto('/cart');
    await this.waitForPageLoad();
    // No additional wait needed - page load is sufficient
  }

  /**
   * Enter email address
   */
  async enterEmail(email: string) {
    await this.emailInput.fill(email);
  }

  /**
   * Select shipping fulfillment type
   */
  async selectShipping() {
    await this.fulfillmentTypeShipping.click();
  }

  /**
   * Select pickup fulfillment type
   */
  async selectPickup() {
    await this.fulfillmentTypePickup.click();
  }

  /**
   * Enter promo code
   */
  async enterPromoCode(code: string) {
    await this.promoCodeInput.fill(code);
  }

  /**
   * Apply promo code
   */
  async applyPromoCode() {
    await this.applyPromoCodeButton.click();
  }

  /**
   * Enter and apply promo code
   */
  async applyPromoCodeComplete(code: string) {
    await this.enterPromoCode(code);
    await this.applyPromoCode();
    // Wait for either success or error message to appear
    await Promise.race([
      this.page.locator('text=/✓.*Discount:/').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {}),
      this.page.locator('text=/Invalid promo code|Failed to validate/').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
    ]);
  }

  /**
   * Click checkout button
   */
  async clickCheckout() {
    await this.checkoutButton.click();
  }

  /**
   * Complete checkout with email and fulfillment type
   */
  async completeCheckout(email: string, fulfillmentType: 'shipping' | 'pickup' = 'shipping') {
    await this.enterEmail(email);
    
    if (fulfillmentType === 'shipping') {
      await this.selectShipping();
    } else {
      await this.selectPickup();
    }
    
    await this.clickCheckout();
    
    // Wait for navigation to checkout page
    await this.page.waitForURL(url => {
      const urlString = url.toString();
      return urlString.includes('checkout.stripe.com') || urlString.includes('/checkout');
    }, { timeout: 10000 });
  }

  /**
   * Check if cart is empty
   */
  async isCartEmpty(): Promise<boolean> {
    const emptyCartText = this.page.locator('text=Your cart is empty');
    return emptyCartText.isVisible();
  }

  /**
   * Get cart item count from the page
   */
  async getCartItemCount(): Promise<number> {
    const itemCountText = await this.page.locator('text=/\\d+ item/').first().textContent();
    if (!itemCountText) return 0;
    const match = itemCountText.match(/(\d+) item/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Get total price from order summary
   */
  async getTotalPrice(): Promise<string> {
    const totalElement = this.page.locator('text=/Total:/').locator('..').locator('text=/\\$\\d+\\.\\d{2}/').last();
    const total = await totalElement.textContent();
    return total || '$0.00';
  }

  /**
   * Check if email validation error is visible
   */
  async isEmailErrorVisible(): Promise<boolean> {
    const errorText = this.page.locator('text="Email is required."');
    return errorText.isVisible();
  }

  /**
   * Check if promo code error is visible
   */
  async isPromoCodeErrorVisible(): Promise<boolean> {
    const errorText = this.page.locator('text=/Invalid promo code|Failed to validate/');
    return errorText.isVisible();
  }

  /**
   * Check if promo code is applied successfully
   */
  async isPromoCodeApplied(): Promise<boolean> {
    const successIndicator = this.page.locator('text=/✓.*Discount:/');
    return successIndicator.isVisible();
  }

  /**
   * Remove an item from cart by index
   */
  async removeItem(index: number = 0) {
    const removeButtons = this.page.locator('button:has-text("Remove")');
    await removeButtons.nth(index).click();
    await this.waitForToast('Item removed from cart');
  }

  /**
   * Update quantity for a cart item
   */
  async updateQuantity(index: number, quantity: number) {
    const quantityInputs = this.page.locator('input[type="number"][aria-label="Quantity"]');
    const quantityInput = quantityInputs.nth(index);
    await quantityInput.fill(quantity.toString());
  }

  /**
   * Get book titles in cart
   */
  async getCartBookTitles(): Promise<string[]> {
    // Wait for cart items to load from localStorage and render
    // First check if cart is not empty
    const emptyCartText = this.page.locator('text=Your cart is empty');
    const isEmptyVisible = await emptyCartText.isVisible().catch(() => false);
    
    if (isEmptyVisible) {
      return [];
    }
    
    // Wait for at least one cart item title to be visible
    const titleElements = this.page.locator('[data-testid^="cart-item-title-"]');
    await titleElements.first().waitFor({ state: 'visible', timeout: 5000 });
    
    // Now get all titles
    const count = await titleElements.count();
    const titles: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const title = await titleElements.nth(i).textContent();
      if (title) titles.push(title.trim());
    }
    
    return titles;
  }
}

