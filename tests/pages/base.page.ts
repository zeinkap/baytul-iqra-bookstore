import { Page } from '@playwright/test';

/**
 * Base Page Object
 * 
 * Contains common functionality shared across all page objects
 */
export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific URL
   */
  async goto(path: string) {
    await this.page.goto(path);
  }

  /**
   * Wait for page to be fully loaded
   * Using 'load' instead of 'networkidle' for faster execution
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('load');
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Wait for a toast notification
   */
  async waitForToast(expectedText?: string) {
    const toastSelector = '[role="status"]';
    await this.page.waitForSelector(toastSelector, { state: 'visible', timeout: 10000 });
    
    if (expectedText) {
      await this.page.waitForSelector(
        `${toastSelector}:has-text("${expectedText}")`,
        { state: 'visible', timeout: 5000 }
      );
    }
  }

  /**
   * Check if toast message is visible
   */
  async isToastVisible(text: string): Promise<boolean> {
    try {
      const toast = this.page.locator(`[role="status"]:has-text("${text}")`);
      await toast.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}

