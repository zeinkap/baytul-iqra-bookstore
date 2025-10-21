import { Page } from '@playwright/test';

/**
 * Wait helpers for common async operations
 * 
 * These helpers provide reusable wait strategies for:
 * - Network requests
 * - Toast notifications
 * - DOM changes
 */

export class WaitHelper {
  constructor(private page: Page) {}

  /**
   * Wait for a network request to complete
   */
  async waitForAPIResponse(urlPattern: string | RegExp) {
    return this.page.waitForResponse(
      response => {
        const url = response.url();
        if (typeof urlPattern === 'string') {
          return url.includes(urlPattern);
        }
        return urlPattern.test(url);
      },
      { timeout: 15000 }
    );
  }

  /**
   * Wait for toast notification to appear
   */
  async waitForToast(expectedText?: string) {
    const toastSelector = '[role="status"]'; // react-hot-toast uses role="status"
    await this.page.waitForSelector(toastSelector, { state: 'visible', timeout: 10000 });
    
    if (expectedText) {
      await this.page.waitForSelector(
        `${toastSelector}:has-text("${expectedText}")`,
        { state: 'visible', timeout: 5000 }
      );
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(urlPattern?: string | RegExp) {
    if (urlPattern) {
      await this.page.waitForURL(urlPattern, { timeout: 30000 });
    } else {
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
    }
  }

  /**
   * Wait for page to be ready (DOM + network idle)
   */
  async waitForPageReady() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for an element to be stable (no animation)
   */
  async waitForElementStable(selector: string) {
    await this.page.locator(selector).waitFor({ state: 'visible' });
    // Wait a bit for animations to complete
    await this.page.waitForTimeout(300);
  }
}

