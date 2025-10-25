import { test, expect } from '../fixtures/base-test';
import { generateTestEmail } from '../fixtures/test-data';

/**
 * End-to-End Test: Contact Page
 * 
 * This test suite covers contact form scenarios:
 * 1. User can successfully send a message via the contact form
 * 2. Form validation works correctly
 */

test.describe('Contact Page', () => {
  test('should allow user to send message via contact form', async ({ contactPage }) => {
    // Navigate to contact page
    await contactPage.navigate();

    // Fill in the contact form
    const testData = {
      name: 'Test User',
      email: generateTestEmail(),
      subject: 'general',
      message: 'This is a test message to verify the contact form functionality.'
    };

    await contactPage.fillContactForm(testData);

    // Submit the form
    await contactPage.submitForm();

    // Verify success message appears
    const isSuccessVisible = await contactPage.isSuccessMessageVisible();
    expect(isSuccessVisible).toBe(true);
  });

  test('should show validation errors for empty required fields', async ({ contactPage }) => {
    // Navigate to contact page
    await contactPage.navigate();

    // Try to submit without filling any fields
    await contactPage.submitForm();

    // The browser's built-in HTML5 validation should prevent submission
    // Verify we're still on the contact page (not redirected/success message shown)
    const isSuccessVisible = await contactPage.isSuccessMessageVisible();
    expect(isSuccessVisible).toBe(false);
  });

  test('should display error message when API fails', async ({ contactPage, page }) => {
    // Navigate to contact page
    await contactPage.navigate();

    // Intercept the contact API call and make it fail
    await page.route('**/api/contact', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    // Fill in the contact form
    const testData = {
      name: 'Test User',
      email: generateTestEmail(),
      subject: 'general',
      message: 'This message should trigger an error.'
    };

    await contactPage.fillContactForm(testData);

    // Submit the form
    await contactPage.submitForm();

    // Verify error message appears
    const isErrorVisible = await contactPage.isErrorMessageVisible();
    expect(isErrorVisible).toBe(true);
  });
});

