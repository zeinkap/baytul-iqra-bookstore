import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Checkout Success Page Object Model
 * 
 * Represents the order confirmation/success page after checkout
 */
export class CheckoutSuccessPage extends BasePage {
  // Locators
  readonly successMessage: Locator;
  readonly orderIdElement: Locator;
  readonly continueShoppingButton: Locator;
  readonly printReceiptButton: Locator;

  constructor(page: Page) {
    super(page);
    this.successMessage = page.getByTestId('order-success-message');
    this.orderIdElement = page.locator('text=/Order ID/').locator('..').locator('.font-mono');
    this.continueShoppingButton = page.locator('button:has-text("Continue Shopping")');
    this.printReceiptButton = page.locator('button:has-text("Print Receipt")');
  }

  /**
   * Wait for success page to load
   */
  async waitForSuccessPage() {
    await this.page.waitForURL('**/checkout/success**', { timeout: 60000 });
    await this.successMessage.waitFor({ state: 'visible', timeout: 30000 });
  }

  /**
   * Check if success message is visible
   */
  async isSuccessMessageVisible(): Promise<boolean> {
    return this.successMessage.isVisible();
  }

  /**
   * Get order ID from the page
   */
  async getOrderId(): Promise<string> {
    const orderId = await this.orderIdElement.textContent();
    return orderId || '';
  }

  /**
   * Get success message text
   */
  async getSuccessMessageText(): Promise<string> {
    const message = await this.successMessage.textContent();
    return message || '';
  }

  /**
   * Click continue shopping button
   */
  async continueShoppingClick() {
    await this.continueShoppingButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Print receipt
   */
  async printReceipt() {
    await this.printReceiptButton.click();
  }

  /**
   * Check if order summary is visible
   */
  async isOrderSummaryVisible(): Promise<boolean> {
    const orderSummary = this.page.locator('text="Order Summary"');
    return orderSummary.isVisible();
  }

  /**
   * Get order total from success page
   */
  async getOrderTotal(): Promise<string> {
    const totalElement = this.page.locator('text=/Total/').locator('..').locator('text=/\\$\\d+\\.\\d{2}/').last();
    const total = await totalElement.textContent();
    return total || '$0.00';
  }

  /**
   * Get order items from success page
   */
  async getOrderItems(): Promise<string[]> {
    const itemElements = this.page.locator('.font-medium.text-gray-900');
    const count = await itemElements.count();
    const items: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const item = await itemElements.nth(i).textContent();
      if (item) items.push(item.trim());
    }
    
    return items;
  }

  /**
   * Check if page is in loading state
   */
  async isLoading(): Promise<boolean> {
    const loadingText = this.page.locator('text="Finalizing your order"');
    return loadingText.isVisible();
  }

  /**
   * Wait for page to finish loading
   */
  async waitForLoadingComplete() {
    // Wait for loading state to disappear
    await this.page.waitForSelector('text="Finalizing your order"', { state: 'hidden', timeout: 30000 });
  }

  /**
   * Get customer name from order info section
   */
  async getCustomerName(): Promise<string> {
    const nameElement = this.page.locator('text=/Name/').locator('..').locator('.text-gray-900');
    const name = await nameElement.textContent();
    return name?.trim() || '';
  }

  /**
   * Get customer email from order info section
   */
  async getCustomerEmail(): Promise<string> {
    const emailElement = this.page.locator('text=/Email/').locator('..').locator('.text-gray-900');
    const email = await emailElement.textContent();
    return email?.trim() || '';
  }

  /**
   * Get shipping address from order info section
   */
  async getShippingAddress(): Promise<string> {
    const addressElement = this.page.locator('text="Shipping Address"').locator('..').locator('.text-gray-900');
    const address = await addressElement.textContent();
    return address?.trim() || '';
  }

  /**
   * Get pickup details from order info section
   */
  async getPickupDetails(): Promise<string> {
    const pickupElement = this.page.locator('text="Pickup Details"').locator('..').locator('.text-gray-900');
    const details = await pickupElement.textContent();
    return details?.trim() || '';
  }
}

