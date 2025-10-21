import { test, expect } from '../fixtures/base-test';
import { initializeAPIHelper, TEST_DATA } from '../helpers/test-workflows.helper';
import type { APIHelper } from '../helpers/api.helper';

/**
 * End-to-End Test: Search Functionality
 * 
 * Tests critical search scenarios:
 * 1. Search by full and partial title (positive tests)
 * 2. No results for invalid search (negative test)
 * 
 * Note: Clear button functionality is better suited for component-level testing
 * as it involves conditional rendering based on React state.
 */

test.describe('Search Functionality', () => {
  let apiHelper: APIHelper;
  let testBook: { id: string; title: string };

  test.beforeEach(async ({ page }) => {
    apiHelper = initializeAPIHelper(page);
    testBook = await apiHelper.findInStockBook();
  });

  test('should search for books by full and partial title', async ({ homePage }) => {
    await homePage.navigate();

    // Search by full title and verify specific book appears
    await homePage.searchForBook(testBook.title);
    expect(await homePage.isBookVisible(testBook.id)).toBe(true);

    // Reset and search by partial title
    await homePage.navigate();
    const partialTitle = testBook.title.substring(0, TEST_DATA.PARTIAL_TITLE_LENGTH);
    await homePage.searchForBook(partialTitle);
    expect(await homePage.getVisibleBooksCount()).toBeGreaterThan(0);
  });

  test('should display no results for invalid search', async ({ homePage }) => {
    await homePage.navigate();
    await homePage.searchForBook(TEST_DATA.INVALID_SEARCH_QUERY);
    expect(await homePage.getVisibleBooksCount()).toBe(0);
  });
});

