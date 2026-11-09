import { test, expect } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

/** The book page shows the book's age range as a badge, and nothing when the book has none. */
test.describe('Book page age range', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  test('shows "Ages 4-7" for a book with that age range', async ({ page }) => {
    const book = await fx.book({ price: 12, stock: 3 });
    await db.book.update({ where: { id: book.id }, data: { ageRange: '4-7' } });
    await page.goto(`/books/${book.id}`);
    await expect(page.getByTestId('book-age-range')).toHaveText('Ages 4-7');
  });

  test('keeps wording like "All ages" as it is', async ({ page }) => {
    const book = await fx.book({ price: 12, stock: 3 });
    await db.book.update({ where: { id: book.id }, data: { ageRange: 'All ages' } });
    await page.goto(`/books/${book.id}`);
    await expect(page.getByTestId('book-age-range')).toHaveText('All ages');
  });

  test('shows no badge when the book has no age range', async ({ page }) => {
    const book = await fx.book({ price: 12, stock: 3 });
    await page.goto(`/books/${book.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    await expect(page.getByTestId('book-age-range')).toHaveCount(0);
  });
});
