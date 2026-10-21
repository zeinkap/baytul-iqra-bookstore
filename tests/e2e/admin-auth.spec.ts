import { test, expect } from '../fixtures/base-test';

/**
 * End-to-End Test: admin authentication
 *
 * Admin pages and admin API calls must be refused without a valid signed session,
 * including with the old forgeable `adminAuth=true` cookie.
 */
test.describe('Admin authentication', () => {
  test('admin API mutations are rejected without a session', async ({ request }) => {
    const create = await request.post('/api/books', { data: { title: 'x' } });
    expect(create.status()).toBe(401);

    const promos = await request.get('/api/promo-codes');
    expect(promos.status()).toBe(401);

    const orders = await request.get('/api/orders');
    expect(orders.status()).toBe(401);

    const scanStats = await request.get('/api/admin/scan-stats');
    expect(scanStats.status()).toBe(401);

    expect((await request.get('/api/admin/stock-counts')).status()).toBe(401);
    expect((await request.post('/api/admin/stock-counts', { data: { counts: [] } })).status()).toBe(401);
    expect((await request.get('/api/admin/feedback')).status()).toBe(401);
    expect((await request.get('/api/admin/insights')).status()).toBe(401);
    expect((await request.post('/api/admin/orders/some-order-id/restock')).status()).toBe(401);
    expect((await request.get('/api/cron/daily-summary')).status()).toBe(401);
    expect((await request.get('/api/cron/daily-summary', { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);
    expect((await request.get('/api/admin/venue')).status()).toBe(401);
    expect((await request.put('/api/admin/venue', { data: { venue: 'cafe-a' } })).status()).toBe(401);
  });

  test('forged cookies do not grant access', async ({ page, baseURL }) => {
    await page.context().addCookies([
      { name: 'adminAuth', value: 'true', url: baseURL! },
      { name: 'admin_session', value: '9999999999.forged', url: baseURL! },
    ]);
    const response = await page.request.get('/api/orders');
    expect(response.status()).toBe(401);

    await page.goto('/admin/orders');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('wrong password is rejected', async ({ request }) => {
    const response = await request.post('/api/admin/auth', { data: { password: 'definitely-wrong' } });
    expect([401, 429]).toContain(response.status());
  });

  test('public book browsing stays open', async ({ request }) => {
    expect((await request.get('/api/books')).status()).toBe(200);
  });
});
