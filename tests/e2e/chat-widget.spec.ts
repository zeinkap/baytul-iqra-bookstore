import { test, expect } from '../fixtures/base-test';

/**
 * End-to-End Test: chat assistant window
 *
 * On a phone the window is a full-screen sheet that follows the visible area (so it stays put when the keyboard
 * opens, which iPhones do not resize the page for), and the keyboard must not pop up by itself when it opens.
 */
test.describe('Chat assistant', () => {
  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });

    test('TC-235: opens as a full-screen sheet without raising the keyboard', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('chat-open').click();

      const panel = page.getByTestId('chat-panel');
      await expect(panel).toBeVisible();
      const box = (await panel.boundingBox())!;
      expect(box.x).toBeCloseTo(0, 0);
      expect(box.y).toBeCloseTo(0, 0);
      expect(box.width).toBeCloseTo(390, 0);
      expect(box.height).toBeCloseTo(700, 0);

      // The keyboard only comes up when the customer taps the field
      await expect(page.getByTestId('chat-input')).not.toBeFocused();
      await page.getByTestId('chat-input').tap();
      await expect(page.getByTestId('chat-input')).toBeFocused();
    });

    test('TC-236: the sheet follows the visible area when it shrinks (keyboard open) and the page behind does not scroll', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('chat-open').click();
      await expect(page.getByTestId('chat-panel')).toBeVisible();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

      // Stand in for the keyboard: the visible area gets shorter
      await page.setViewportSize({ width: 390, height: 400 });
      await expect.poll(async () => Math.round((await page.getByTestId('chat-panel').boundingBox())!.height)).toBe(400);
      const box = (await page.getByTestId('chat-panel').boundingBox())!;
      expect(box.y).toBeCloseTo(0, 0);
      // The title bar and the message box are both still on screen
      await expect(page.getByText('Baytul Iqra Assistant')).toBeInViewport();
      await expect(page.getByTestId('chat-input')).toBeInViewport();

      await page.getByTestId('chat-close').click();
      await expect(page.getByTestId('chat-panel')).toHaveCount(0);
      // The page scrolls again
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    });
  });

  test.describe('on a computer', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('TC-237: stays a small window in the corner, with the field ready to type in', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('chat-open').click();

      const box = (await page.getByTestId('chat-panel').boundingBox())!;
      expect(box.width).toBeCloseTo(380, 0);
      expect(box.height).toBeCloseTo(560, 0);
      expect(box.x + box.width).toBeCloseTo(1280 - 16, 0);
      await expect(page.getByTestId('chat-input')).toBeFocused();
    });
  });
});
