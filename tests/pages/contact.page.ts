import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Contact Page Object Model
 * 
 * Represents the contact form page
 */
export class ContactPage extends BasePage {
  // Form field locators
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly subjectSelect: Locator;
  readonly messageTextarea: Locator;
  readonly submitButton: Locator;
  
  // Status message locators
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.locator('input#name');
    this.emailInput = page.locator('input#email');
    this.subjectSelect = page.locator('select#subject');
    this.messageTextarea = page.locator('textarea#message');
    this.submitButton = page.locator('button[type="submit"]');
    this.successMessage = page.locator('text="Message Sent!"');
    this.errorMessage = page.locator('text="Message Failed to Send"');
  }

  /**
   * Navigate to contact page
   */
  async navigate() {
    await this.goto('/contact');
    await this.waitForPageLoad();
  }

  /**
   * Fill in the contact form
   */
  async fillContactForm(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);
    await this.subjectSelect.selectOption(data.subject);
    await this.messageTextarea.fill(data.message);
  }

  /**
   * Submit the contact form
   */
  async submitForm() {
    await this.submitButton.click();
  }

  /**
   * Check if success message is visible
   */
  async isSuccessMessageVisible(): Promise<boolean> {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if error message is visible
   */
  async isErrorMessageVisible(): Promise<boolean> {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if submit button is disabled
   */
  async isSubmitButtonDisabled(): Promise<boolean> {
    return this.submitButton.isDisabled();
  }

  /**
   * Get submit button text
   */
  async getSubmitButtonText(): Promise<string> {
    const text = await this.submitButton.textContent();
    return text?.trim() || '';
  }
}

