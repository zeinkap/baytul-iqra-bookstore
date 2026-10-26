import { prisma } from './prisma';
import { computeInsights, STORE_TIME_ZONE } from './insights';
import { loadInsightInputs } from './insightsData';
import { SCAN_STATUSES } from './scanStatus';
import { getVenueFees } from './venueFees';

const money = (n: number) => `$${n.toFixed(2)}`;
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const METHODS: Record<string, string> = { apple_pay: 'Apple Pay', google_pay: 'Google Pay', card: 'Card', link: 'Link', cash: 'Cash', zelle: 'Zelle', other: 'Other', unknown: 'Not recorded' };
const NO_VENUE = '(no venue tag)';

/** Gathers the last 24 hours of activity and renders the end-of-day email. */
export async function buildDailySummary(now: Date = new Date()) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const abandonedBefore = new Date(now.getTime() - 30 * 60 * 1000);
  const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: STORE_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' }).format(now);

  const [{ orders, books }, venueFees, scansByVenue, scansByStatus, abandonedOrders, refunded, feedback] = await Promise.all([
    loadInsightInputs(),
    getVenueFees(),
    prisma.scan.groupBy({ by: ['location'], where: { createdAt: { gte: since }, status: { in: SCAN_STATUSES } }, _count: { _all: true } }),
    prisma.scan.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.order.findMany({ where: { source: 'in-shop', paidAt: null, createdAt: { gte: since, lte: abandonedBefore } }, select: { location: true } }),
    prisma.order.findMany({ where: { refundedAt: { gte: since } }, select: { refundedAmount: true } }),
    prisma.feedback.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  const today = computeInsights(orders, books, [], { days: 1, source: 'all', now });
  const month = computeInsights(orders, books, [], { days: 30, source: 'all', now });
  const restock = month.restock.restock.slice(0, 8);

  const status = (s: string) => scansByStatus.find((x) => x.status === s)?._count._all ?? 0;
  const scans = scansByStatus.filter((s) => SCAN_STATUSES.includes(s.status)).reduce((n, s) => n + s._count._all, 0);
  const salesToday = orders.filter((o) => o.paidAt >= since);
  const refundCount = refunded.length;
  const refundTotal = refunded.reduce((n, r) => n + (r.refundedAmount ?? 0), 0);

  const venues = new Map<string, { scans: number; sales: number; revenue: number; abandoned: number }>();
  const venue = (name: string | null) => {
    const k = name ?? NO_VENUE;
    if (!venues.has(k)) venues.set(k, { scans: 0, sales: 0, revenue: 0, abandoned: 0 });
    return venues.get(k)!;
  };
  for (const s of scansByVenue) venue(s.location).scans += s._count._all;
  for (const o of salesToday) {
    const v = venue(o.location);
    v.sales += 1;
    v.revenue += o.finalTotal;
  }
  for (const o of abandonedOrders) venue(o.location).abandoned += 1;
  const venueRows = [...venues.entries()].sort((a, b) => b[1].revenue - a[1].revenue || b[1].scans - a[1].scans);

  // Venues with a flat fee (e.g. a $50 bazaar stall): profit so far at that venue against the fee
  const eventLines = venueRows
    .filter(([name]) => venueFees[name] !== undefined)
    .flatMap(([name]) => {
      const row = computeInsights(orders, books, [], { days: 90, source: 'in-shop', venue: name, venueFees, now }).events.rows.find((r) => r.venue === name);
      if (!row || row.fee === null) return [];
      return [{
        name,
        text: `${money(row.fee)} fee, ${money(row.profitBeforeFee)} profit so far: ${row.covered ? `covered, ${money(row.net)} ahead` : `${money(row.stillToCover ?? 0)} still to cover`}`,
      }];
    });

  const failed = { unknown: status('not-found'), soldOut: status('sold-out'), buy: status('buy-failed'), page: status('page-error') };
  const hasActivity = scans > 0 || salesToday.length > 0 || refundCount > 0 || feedback.length > 0 || abandonedOrders.length > 0;
  const { revenue, profitAfterFees, grossProfit } = today.profit;
  const methods = today.payments.methods;

  const subject = salesToday.length
    ? `Daily summary ${dateLabel}: ${money(revenue)} from ${salesToday.length} sale${salesToday.length === 1 ? '' : 's'}`
    : `Daily summary ${dateLabel}: no sales, ${scans} scan${scans === 1 ? '' : 's'}`;

  const li = (items: string[]) => items.map((i) => `<li style="margin:3px 0;">${i}</li>`).join('');
  const section = (title: string, body: string) =>
    `<h2 style="font-size:15px; margin:22px 0 6px; color:#065f46;">${title}</h2>${body}`;
  const html = `<!doctype html>
<html><body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; color:#111827;">
  <div style="max-width:600px; margin:0 auto; padding:24px 16px;">
    <div style="background:#ffffff; border-radius:12px; padding:24px;">
      <div style="font-size:13px; color:#6b7280;">Last 24 hours &middot; ${esc(dateLabel)}</div>
      <div style="font-size:30px; font-weight:800; margin:2px 0;">${money(revenue)} <span style="font-size:15px; font-weight:500; color:#6b7280;">from ${salesToday.length} sale${salesToday.length === 1 ? '' : 's'}</span></div>
      <div style="font-size:14px; color:#374151;">Est. profit ${money(profitAfterFees)} after card fees <span style="color:#6b7280;">(${money(grossProfit)} before)</span></div>

      ${section('Scans', `<ul style="padding-left:18px; margin:0; font-size:14px;">${li([
        `${scans} scan${scans === 1 ? '' : 's'}${scans > 0 ? `, ${Math.round((salesToday.length / scans) * 100)}% ended in a sale` : ''}`,
        `${abandonedOrders.length} abandoned checkout${abandonedOrders.length === 1 ? '' : 's'} (tapped Buy now, never paid)`,
        ...(failed.soldOut ? [`${failed.soldOut} scan${failed.soldOut === 1 ? '' : 's'} of sold-out books (lost sales)`] : []),
        ...(failed.unknown ? [`<b>${failed.unknown} unknown code${failed.unknown === 1 ? '' : 's'}</b>: a sticker points to no book`] : []),
        ...(failed.buy || failed.page ? [`<b>${failed.buy + failed.page} error${failed.buy + failed.page === 1 ? '' : 's'}</b>: ${failed.buy} Buy now, ${failed.page} page crash${failed.page === 1 ? '' : 'es'}`] : []),
      ])}</ul>`)}

      ${venueRows.length ? section('By venue', `<table style="border-collapse:collapse; width:100%; font-size:14px;">
        <tr style="color:#6b7280; text-align:right;"><td style="text-align:left;">Venue</td><td>Scans</td><td>Sales</td><td>Revenue</td><td>Abandoned</td></tr>
        ${venueRows.map(([name, v]) => `<tr style="text-align:right; border-top:1px solid #eee;"><td style="text-align:left; padding:4px 0;">${esc(name)}</td><td>${v.scans}</td><td>${v.sales}</td><td>${money(v.revenue)}</td><td>${v.abandoned}</td></tr>`).join('')}
      </table>`) : ''}

      ${eventLines.length ? section('Event fees', `<ul style="padding-left:18px; margin:0; font-size:14px;">${li(eventLines.map((e) => `<b>${esc(e.name)}</b>: ${esc(e.text)}`))}</ul>`) : ''}

      ${methods.length ? section('Paid with', `<div style="font-size:14px;">${methods.map((m) => `${esc(METHODS[m.method] ?? m.method)}: ${m.orders}`).join(' &middot; ')}</div>`) : ''}

      ${refundCount ? section('Refunds', `<div style="font-size:14px;">${refundCount} refund${refundCount === 1 ? '' : 's'}, ${money(refundTotal)} total. Open Admin &rarr; Orders to put returned books back in stock.</div>`) : ''}

      ${restock.length ? section('Restock soon', `<ul style="padding-left:18px; margin:0; font-size:14px;">${li(restock.map((r) => `${esc(r.title)}: ${r.stock === 0 ? '<b>sold out</b>' : `${r.stock} left (about ${r.weeksLeft} week${r.weeksLeft === 1 ? '' : 's'})`}`))}</ul>`) : ''}

      ${feedback.length ? section('Book requests', `<ul style="padding-left:18px; margin:0; font-size:14px;">${li(feedback.map((f) => `${esc(f.message)}${f.location ? ` <span style="color:#6b7280;">(${esc(f.location)})</span>` : ''}`))}</ul>`) : ''}
    </div>
    <p style="font-size:12px; color:#6b7280; text-align:center; margin:14px 0 0;">Sent automatically each evening. Full details are in Admin &rarr; QR Scans and Insights.</p>
  </div>
</body></html>`;

  const text = [
    subject,
    `Est. profit ${money(profitAfterFees)} after card fees`,
    '',
    `Scans: ${scans}; abandoned checkouts: ${abandonedOrders.length}; sold-out scans: ${failed.soldOut}; unknown codes: ${failed.unknown}; errors: ${failed.buy + failed.page}`,
    ...venueRows.map(([name, v]) => `${name}: ${v.scans} scans, ${v.sales} sales, ${money(v.revenue)}, ${v.abandoned} abandoned`),
    ...eventLines.map((e) => `Event fee, ${e.name}: ${e.text}`),
    ...(refundCount ? [`Refunds: ${refundCount} (${money(refundTotal)})`] : []),
    ...(restock.length ? ['', 'Restock soon:', ...restock.map((r) => `- ${r.title}: ${r.stock} left`)] : []),
    ...(feedback.length ? ['', 'Book requests:', ...feedback.map((f) => `- ${f.message}`)] : []),
  ].join('\n');

  return { subject, html, text, hasActivity, stats: { scans, sales: salesToday.length, revenue, abandoned: abandonedOrders.length, refunds: refundCount } };
}
