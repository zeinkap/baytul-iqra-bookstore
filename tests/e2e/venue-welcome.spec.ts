import { test, expect } from '../fixtures/base-test';
import { VENUE_STEPS, boldSegments } from '../../src/lib/venueCopy';

/**
 * End-to-End Test: venue sign landing (/v/<venue> -> /venue/welcome)
 *
 * The welcome page and the printed venue signs (npm run qr:venue-signs) share their steps from
 * src/lib/venueCopy.ts, so the steps checked here are exactly what the sign prints.
 */
test.describe('Venue welcome', () => {
  test('scanning a venue sign lands on the welcome page with the shared steps', async ({ page }) => {
    await page.goto('/v/test-cafe');

    await expect(page).toHaveURL(/\/venue\/welcome\?v=test-cafe/);
    await expect(page.getByRole('heading', { name: 'Welcome to Test Cafe!' })).toBeVisible();
    for (const step of VENUE_STEPS) {
      const plain = boldSegments(step).map((s) => s.text).join('');
      await expect(page.getByTestId('venue-welcome')).toContainText(plain);
    }
    await expect(page.locator('header')).toHaveCount(0);
  });

  test('an invalid venue goes to the home page', async ({ page }) => {
    await page.goto('/v/Not%20A%20Venue!');
    await expect(page).toHaveURL(/\/$/);
  });
});
