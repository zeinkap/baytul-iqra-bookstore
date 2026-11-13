import { test, expect } from '@playwright/test';
import { ART_CATEGORY } from '../../src/lib/artCollection';
import { Fixtures, db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

/**
 * One shared QR sticker goes on every painting, so it opens a generic scan-only item ("Names of Allah Painting
 * Series", $35, no photo). It sells like any painting, but it isn't a gallery card.
 */
test.describe('Painting series scan page', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  async function painting(opts: { images: string[]; price: number; stock: number; title?: string }) {
    const book = await fx.book({ price: opts.price, stock: opts.stock });
    await db.category.upsert({ where: { name: ART_CATEGORY }, update: {}, create: { name: ART_CATEGORY } });
    return db.book.update({
      where: { id: book.id },
      data: { images: opts.images, ...(opts.title ? { title: opts.title } : {}), categories: { connect: { name: ART_CATEGORY } } },
    });
  }

  test('TC-257: a photo-less series item sells from its scan page: title, $35, no photo, quantity in paintings', async ({ page }) => {
    const item = await painting({ images: [], price: 35, stock: 100, title: `E2E Painting Series ${Date.now()}` });
    await page.goto(`/b/${item.id}`);
    await expect(page.getByTestId('scan-book-title')).toHaveText(item.title);
    await expect(page.getByTestId('scan-buy-now')).toContainText('$35.00');
    await expect(page.getByTestId('scan-cover')).toHaveCount(0);
    // It's a painting, so the quantity reads "1 painting", not "1 copy"
    await expect(page.getByTestId('scan-qty-value')).toHaveText('1 painting');
    await page.getByTestId('scan-qty-plus').click();
    await expect(page.getByTestId('scan-qty-value')).toHaveText('2 paintings');
    await expect(page.getByTestId('scan-buy-now')).toContainText('$70.00');
    // Plenty in stock: no "only 3 left" or "one-of-a-kind" notice
    await expect(page.getByTestId('scan-low-stock')).toHaveCount(0);
    await expect(page.getByTestId('scan-one-of-a-kind')).toHaveCount(0);
  });

  test('TC-258: the gallery lists paintings with a photo and leaves out the photo-less series item', async ({ page }) => {
    const stamp = Date.now();
    const withPhoto = await painting({ images: ['/placeholder.svg'], price: 35, stock: 1, title: `E2E Gallery Piece ${stamp}` });
    const series = await painting({ images: [], price: 35, stock: 100, title: `E2E Series Item ${stamp}` });
    await page.goto('/art-canvases');
    await expect(page.getByTestId('art-collection-grid')).toContainText(withPhoto.title);
    await expect(page.getByTestId('art-collection-grid')).not.toContainText(series.title);
  });
});
