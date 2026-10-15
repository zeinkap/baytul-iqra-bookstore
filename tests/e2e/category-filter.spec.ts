import { test, expect } from '../fixtures/base-test';

/**
 * End-to-End Test: Category Filtering
 *
 * Flow first explored live with playwright-cli, then codified here:
 * 1. Selecting a category narrows the book list to that category
 * 2. Selecting several categories and clicking "Clear All" restores the full list
 */

const HADITH = 'Hadith & Sunnah';
const BIOGRAPHY = 'Biography & Seerah';

test.describe('Category Filtering', () => {
  test('should show only books from the selected category', async ({ homePage }) => {
    await homePage.navigate();
    await homePage.waitForBooksToLoad();
    const totalBooks = await homePage.getVisibleBooksCount();

    await homePage.toggleCategory(HADITH);
    await expect
      .poll(() => homePage.getVisibleBooksCount())
      .toBeLessThan(totalBooks);

    const cardTexts = await homePage.getVisibleBookCardTexts();
    expect(cardTexts.length).toBeGreaterThan(0);
    for (const text of cardTexts) {
      expect(text).toContain(HADITH);
    }
  });

  test('should restore all books after clearing multiple selected categories', async ({ homePage }) => {
    await homePage.navigate();
    await homePage.waitForBooksToLoad();
    const totalBooks = await homePage.getVisibleBooksCount();

    await homePage.toggleCategory(HADITH);
    await homePage.toggleCategory(BIOGRAPHY);
    await expect
      .poll(() => homePage.getVisibleBooksCount())
      .toBeLessThan(totalBooks);

    await homePage.clearAllCategories();
    await expect
      .poll(() => homePage.getVisibleBooksCount())
      .toBe(totalBooks);
  });
});
