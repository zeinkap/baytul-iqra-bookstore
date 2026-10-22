import { test, expect } from '@playwright/test';
import { Fixtures, db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

/**
 * Catalog cache (src/lib/catalog.ts): the home page and book pages read books through the Next.js data cache (the home page list is drawn in the browser, so only the server-rendered book page is asserted here),
 * tagged 'books'. Editing a book in the admin must show up straight away (the admin routes clear that tag).
 *
 * Runs against a production build (see playwright.config.cache.ts): in development the cache is bypassed.
 */
test.describe('Catalog cache', () => {
  test.skip(!localDbAvailable || !process.env.ADMIN_PASSWORD, 'needs a local database and ADMIN_PASSWORD');
  const fx = new Fixtures();
  test.afterAll(async () => {
    await fx.cleanup();
    await disconnect();
  });

  test('a book page serves cached data until an admin edit clears it', async ({ request }) => {
    const book = await fx.book({ stock: 4, price: 9.5 });
    const original = book.title;
    const html = async (path: string) => (await request.get(path)).text();

    // First visits fill the cache
    expect(await html(`/books/${book.id}`)).toContain(original);

    // A change made behind the app's back (straight in the database) is not visible yet: the pages are cached
    const sneaky = `${original} (changed in DB)`;
    await db.book.update({ where: { id: book.id }, data: { title: sneaky } });
    expect(await html(`/books/${book.id}`)).toContain(original);
    expect(await html(`/books/${book.id}`)).not.toContain(sneaky);

    // An edit through the admin API clears the 'books' cache, so the page shows the new data immediately
    const login = await request.post('/api/admin/auth', { data: { password: process.env.ADMIN_PASSWORD } });
    expect(login.status()).toBe(200);
    const cookie = login.headers()['set-cookie'].split(';')[0];
    const edited = `${original} (edited by admin)`;
    const put = await request.put(`/api/books/${book.id}`, {
      headers: { cookie },
      data: { title: edited, author: book.author, description: book.description, price: 11, stock: 4, categories: [] },
    });
    expect(put.status()).toBe(200);

    const detail = await html(`/books/${book.id}`);
    expect(detail).toContain(edited);
    expect(detail).not.toContain(sneaky);
  });
});
