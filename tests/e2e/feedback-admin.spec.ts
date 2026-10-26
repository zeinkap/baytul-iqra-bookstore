import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { ADMIN_COOKIE, createSessionToken } from '../../src/lib/adminAuth';
import { db, disconnect, localDbAvailable } from '../helpers/money-path.helper';

/** Admin → Requests: mark customer book requests as in progress or fulfilled, or delete them. */
test.describe('Book requests: admin', () => {
  test.skip(!localDbAvailable || !process.env.ADMIN_PASSWORD, 'needs a local database and ADMIN_PASSWORD');
  const ids: string[] = [];
  test.afterAll(async () => {
    await db.feedback.deleteMany({ where: { id: { in: ids } } });
    await disconnect();
  });
  const headers = async () => ({ cookie: `${ADMIN_COOKIE}=${await createSessionToken()}` });
  const request1 = async (message = `E2E request ${randomUUID().slice(0, 8)}`) => {
    const row = await db.feedback.create({ data: { message } });
    ids.push(row.id);
    return row;
  };
  const statusOf = async (id: string) => (await db.feedback.findUniqueOrThrow({ where: { id } })).status;

  test('new requests start as "new"', async () => {
    expect((await request1()).status).toBe('new');
  });

  test('needs an admin session', async ({ request }) => {
    const row = await request1();
    expect((await request.patch(`/api/admin/feedback/${row.id}`, { data: { status: 'fulfilled' } })).status()).toBe(401);
    expect((await request.delete(`/api/admin/feedback/${row.id}`)).status()).toBe(401);
    expect(await statusOf(row.id)).toBe('new');
  });

  test('status can be changed between new, in-progress and fulfilled, but not to anything else', async ({ request }) => {
    const row = await request1();
    for (const status of ['in-progress', 'fulfilled', 'new']) {
      const res = await request.patch(`/api/admin/feedback/${row.id}`, { headers: await headers(), data: { status } });
      expect(res.status()).toBe(200);
      expect(await statusOf(row.id)).toBe(status);
    }
    for (const data of [{ status: 'done' }, { status: '' }, {}]) {
      expect((await request.patch(`/api/admin/feedback/${row.id}`, { headers: await headers(), data })).status()).toBe(400);
    }
    expect((await request.patch('/api/admin/feedback/does-not-exist', { headers: await headers(), data: { status: 'fulfilled' } })).status()).toBe(404);
  });

  test('a request can be deleted once', async ({ request }) => {
    const row = await request1();
    expect((await request.delete(`/api/admin/feedback/${row.id}`, { headers: await headers() })).status()).toBe(200);
    expect(await db.feedback.findUnique({ where: { id: row.id } })).toBeNull();
    expect((await request.delete(`/api/admin/feedback/${row.id}`, { headers: await headers() })).status()).toBe(404);
  });

  test('the page marks requests in progress and fulfilled, filters them and deletes them', async ({ page, context, baseURL }) => {
    const tag = randomUUID().slice(0, 8);
    const row = await request1(`E2E page request ${tag}`);
    await context.addCookies([{ name: ADMIN_COOKIE, value: (await createSessionToken())!, url: baseURL! }]);
    await page.goto('/admin/feedback');

    const item = page.getByTestId('feedback-item').filter({ hasText: tag });
    await expect(item.getByTestId('feedback-status')).toHaveText('New');

    await item.getByTestId('feedback-in-progress').click();
    await expect(item.getByTestId('feedback-status')).toHaveText('In progress');
    await expect.poll(() => statusOf(row.id)).toBe('in-progress');

    await item.getByTestId('feedback-fulfilled').click();
    await expect(item.getByTestId('feedback-status')).toHaveText('Fulfilled');
    await expect.poll(() => statusOf(row.id)).toBe('fulfilled');

    // Filtering: it is no longer under "New", and shows under "Fulfilled"
    await page.getByTestId('feedback-filter-new').click();
    await expect(item).toHaveCount(0);
    await page.getByTestId('feedback-filter-fulfilled').click();
    await expect(item).toHaveCount(1);

    await item.getByTestId('feedback-reopen').click();
    await expect.poll(() => statusOf(row.id)).toBe('new');

    page.once('dialog', (d) => d.accept());
    await page.getByTestId('feedback-filter-all').click();
    await item.getByTestId('feedback-delete').click();
    await expect(item).toHaveCount(0);
    await expect.poll(() => db.feedback.findUnique({ where: { id: row.id } })).toBeNull();
  });
});
