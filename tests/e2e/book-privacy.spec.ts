import { test, expect } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

/**
 * What the shop pays for a book (cost price, shipping cost) must never reach a visitor: not through the public
 * books API, and not inside the page HTML. A signed-in admin still gets it (the profit margins page needs it).
 */
test.describe('Book data privacy', () => {
  test.skip(!localDbAvailable, 'needs a local database (the tests create and delete their own rows)');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  async function bookWithCosts() {
    const book = await fx.book({ price: 20, stock: 3 });
    await db.book.update({ where: { id: book.id }, data: { costPrice: 7.77, shippingCost: 3.33 } });
    return book;
  }

  test('the public books list, a single book and a category list leave out costs', async ({ request }) => {
    const book = await bookWithCosts();

    const list = (await (await request.get('/api/books')).json()) as Record<string, unknown>[];
    const inList = list.find((b) => b.id === book.id)!;
    expect(inList.price).toBe(20);
    expect('costPrice' in inList).toBe(false);
    expect('shippingCost' in inList).toBe(false);

    const single = await (await request.get(`/api/books/${book.id}`)).json();
    expect(single.title).toBe(book.title);
    expect('costPrice' in single).toBe(false);
    expect('shippingCost' in single).toBe(false);

    const rows = await db.book.findUniqueOrThrow({ where: { id: book.id }, include: { categories: true } });
    if (rows.categories[0]) {
      const byCategory = (await (await request.get(`/api/books/category/${encodeURIComponent(rows.categories[0].name)}`)).json()) as Record<string, unknown>[];
      expect(byCategory.length).toBeGreaterThan(0);
      for (const b of byCategory) {
        expect('costPrice' in b).toBe(false);
        expect('shippingCost' in b).toBe(false);
      }
    }
  });

  test('costs are not in the book page HTML', async ({ request }) => {
    const book = await bookWithCosts();
    const html = await (await request.get(`/books/${book.id}`)).text();
    expect(html).toContain(book.title.slice(0, 20));
    expect(html).not.toContain('costPrice');
    expect(html).not.toContain('shippingCost');
    expect(html).not.toContain('7.77');
  });

  test('a signed-in admin still gets costs from the books API', async ({ request }) => {
    test.skip(!process.env.ADMIN_PASSWORD, 'needs ADMIN_PASSWORD');
    const book = await bookWithCosts();
    const login = await request.post('/api/admin/auth', { data: { password: process.env.ADMIN_PASSWORD } });
    test.skip(login.status() === 429, 'admin login is rate limited right now');
    expect(login.status()).toBe(200);

    const list = (await (await request.get('/api/books')).json()) as Record<string, unknown>[];
    expect(list.find((b) => b.id === book.id)).toMatchObject({ costPrice: 7.77, shippingCost: 3.33 });
    const single = await (await request.get(`/api/books/${book.id}`)).json();
    expect(single).toMatchObject({ costPrice: 7.77, shippingCost: 3.33 });
  });
});
