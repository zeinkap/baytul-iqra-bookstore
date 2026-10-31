import { test, expect } from '../fixtures/base-test';
import { initializeAPIHelper, setupCartViaLocalStorage } from '../helpers/test-workflows.helper';

/**
 * End-to-End Test: QR direct-to-cart (/b/<code>)
 *
 * Uses the book id as the code (the fallback for books without an ISBN),
 * so it doesn't depend on ISBN data existing in the test database.
 * A scan shows the book with a single "Buy now" action (it goes to Stripe, so it's only
 * checked for presence here); the email-only cart mode is covered by seeding its state.
 */
test.describe('QR scan to cart', () => {
  test('scan shows the book with a single Buy now action', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);

    await expect(page.getByTestId('scan-book-title')).toHaveText(book.title);
    await expect(page.getByTestId('scan-buy-now')).toBeVisible();
    await expect(page.getByTestId('scan-add-to-cart')).toHaveCount(0);
    await expect(page.getByTestId('scan-trust-note')).toContainText('Stripe');
    await expect(page.getByTestId('scan-description')).toBeVisible();
    await expect(page.getByTestId('scan-description')).not.toContainText(/<\/?(p|em|br|strong|ul|li)\b/i);
  });

  test('quantity stepper changes the Buy now total and stays within stock', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);

    if (book.stock < 2) {
      await expect(page.getByTestId('scan-quantity')).toHaveCount(0);
      return;
    }
    await expect(page.getByTestId('scan-qty-value')).toHaveText('1 copy');
    await expect(page.getByTestId('scan-qty-minus')).toBeDisabled();
    await page.getByTestId('scan-qty-plus').click();
    await expect(page.getByTestId('scan-qty-value')).toHaveText('2 copies');
    await expect(page.getByTestId('scan-buy-now')).toContainText(`$${(book.price * 2).toFixed(2)}`);
  });

  test('scan page is focused: tax note shown, no navbar or chat button', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);

    await expect(page.getByTestId('scan-tax-note')).toHaveText('· Tax included');
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Baytul Iqra Bookstore' })).toBeVisible();
    await expect(page.getByText('Ask us')).toHaveCount(0);
  });

  test('in-shop cart mode asks only for email (no shipping/pickup choice)', async ({ page, cartPage }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await setupCartViaLocalStorage(page, cartPage, [book]);
    await page.evaluate(() => sessionStorage.setItem('checkoutMode', 'in-shop'));
    await page.reload();

    await expect(cartPage.emailInput).toBeVisible();
    await expect(cartPage.fulfillmentTypeShipping).toHaveCount(0);
    await expect(cartPage.fulfillmentTypePickup).toHaveCount(0);
  });

  test('unknown code shows a friendly message with book suggestions', async ({ page }) => {
    await page.goto('/b/0000000000000');
    await expect(page.getByTestId('scan-message-title')).toHaveText("We couldn't find that book");
    await expect(page.getByTestId('scan-suggestions')).toBeVisible();
  });

  test('tapping the cover opens the larger photo viewer', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    await page.goto(`/b/${book.id}`);
    await page.getByTestId('scan-cover').click();

    await expect(page.locator('.yarl__container')).toBeVisible();
  });

  test('the venue tag in the link is recorded with the scan', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    const scanRequest = page.waitForRequest((r) => r.url().includes('/api/scans') && r.method() === 'POST');
    await page.goto(`/b/${book.id}?loc=test-venue`);
    expect((await scanRequest).postDataJSON()).toEqual({ code: book.id, location: 'test-venue' });
  });

  test('a Buy now failure is reported so it shows up as a failed scan', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();
    // Make the buy request fail like a server error
    await page.route('**/api/in-shop/buy', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));

    await page.goto(`/b/${book.id}`);
    const failureRequest = page.waitForRequest((r) => r.url().includes('/api/scans') && r.postDataJSON()?.event === 'buy-failed');
    await page.getByTestId('scan-buy-now').click();

    expect((await failureRequest).postDataJSON()).toMatchObject({ code: book.isbn ?? book.id, event: 'buy-failed', detail: 'checkout-failed' });
    await expect(page.getByTestId('scan-buy-now')).toBeEnabled();
  });

  test('scans are recorded', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();

    const scanRequest = page.waitForRequest((r) => r.url().includes('/api/scans') && r.method() === 'POST');
    await page.goto(`/b/${book.id}`);
    // The venue may also be attached (from the admin's current-venue setting), so only the code is asserted
    expect((await scanRequest).postDataJSON()).toMatchObject({ code: book.id });
  });

  test('an out-of-stock book shows a message and similar books, with no way to buy it', async ({ page }) => {
    let book;
    try {
      book = await initializeAPIHelper(page).findOutOfStockBook();
    } catch {
      test.skip(true, 'No out-of-stock book in the test database');
      return;
    }

    await page.goto(`/b/${book.id}`);

    await expect(page.getByTestId('scan-message-title')).toContainText('out of stock');
    await expect(page.getByTestId('scan-suggestions')).toBeVisible();
    await expect(page.getByTestId('scan-buy-now')).toHaveCount(0);
    await expect(page.getByTestId('scan-add-to-basket')).toHaveCount(0);
  });

  test('a sold-out response tells the customer, reports sold-out-race and re-enables the button', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();
    await page.route('**/api/in-shop/buy', (route) =>
      route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"Sorry, this book just sold out."}' })
    );

    await page.goto(`/b/${book.id}`);
    const failureRequest = page.waitForRequest((r) => r.url().includes('/api/scans') && r.postDataJSON()?.event === 'buy-failed');
    await page.getByTestId('scan-buy-now').click();

    await expect(page.getByText('Sorry, this book just sold out.')).toBeVisible();
    expect((await failureRequest).postDataJSON()).toMatchObject({ event: 'buy-failed', detail: 'sold-out-race' });
    await expect(page.getByTestId('scan-buy-now')).toBeEnabled();
  });

  test('if Stripe.js cannot load, the card button still appears as the main pay button', async ({ page }) => {
    const book = await initializeAPIHelper(page).findInStockBook();
    await page.route('https://js.stripe.com/**', (route) => route.abort());

    await page.goto(`/b/${book.id}`);

    // The wallet check gives up after a few seconds and falls back to the plain card button
    await expect(page.getByTestId('scan-buy-now')).toContainText('Pay with card', { timeout: 10_000 });
    await expect(page.getByTestId('wallet-skeleton')).toHaveCount(0);
    await expect(page.getByTestId('scan-buy-now')).toBeEnabled();
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('no sideways scrolling, and the pinned pay bar never hides the page content', async ({ page }) => {
      const book = await initializeAPIHelper(page).findInStockBook();

      await page.goto(`/b/${book.id}`);
      await expect(page.getByTestId('scan-buy-now')).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      // Scrolled to the bottom, the last line of the page ends above the pay bar
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const trust = await page.getByTestId('scan-trust-note').boundingBox();
      const pay = await page.getByTestId('in-shop-pay').boundingBox();
      expect(trust).not.toBeNull();
      expect(pay).not.toBeNull();
      expect(trust!.y + trust!.height).toBeLessThanOrEqual(pay!.y);
    });

    test('the price and the pay button are on screen without scrolling', async ({ page }) => {
      const book = await initializeAPIHelper(page).findInStockBook();

      await page.goto(`/b/${book.id}`);

      await expect(page.getByTestId('scan-buy-now')).toBeInViewport();
      await expect(page.getByTestId('scan-tax-note')).toBeInViewport();
    });
  });
});
