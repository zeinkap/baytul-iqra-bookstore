import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number) => `$${n.toFixed(2)}`;
const siteUrl = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.baytuliqra.com').replace(/\/$/, '');

export async function sendOrderConfirmationEmail({
  to,
  orderId,
  items,
  total,
  fulfillmentType,
  source,
  shippingAddress,
}: {
  to: string;
  orderId: string;
  items: { title: string; quantity: number; price: number }[];
  total: number;
  fulfillmentType: string;
  source?: string;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}) {
  const inShop = source === 'in-shop';
  const base = siteUrl();
  const shortRef = orderId.slice(-8).toUpperCase();
  const receiptUrl = `${base}/${inShop ? 'receipt' : 'checkout/success'}?orderId=${encodeURIComponent(orderId)}`;
  const orderDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  const subject = inShop ? `Your Baytul Iqra receipt, ${money(total)}` : 'Your Baytul Iqra Bookstore Order Confirmation';

  const intro = inShop
    ? 'Thanks for your purchase at the shop. Enjoy your book! This email is your receipt.'
    : fulfillmentType === 'pickup'
    ? "Your order is ready for free local pickup in Alpharetta, GA. We'll contact you soon with pickup instructions."
    : "Your order will be shipped to your address. You'll receive another email with tracking details once it ships.";

  const addressLines =
    fulfillmentType === 'shipping' && shippingAddress && typeof shippingAddress === 'object'
      ? [shippingAddress.name, shippingAddress.line1, shippingAddress.line2, [shippingAddress.city, shippingAddress.state, shippingAddress.postal_code].filter(Boolean).join(', '), shippingAddress.country].filter(Boolean) as string[]
      : [];

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid #eee;">${escapeHtml(item.title)}<br><span style="color:#6b7280; font-size:13px;">Qty ${item.quantity} &times; ${money(item.price)}</span></td>
          <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right; white-space:nowrap;">${money(item.price * item.quantity)}</td>
        </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; color:#111827;">
  <div style="max-width:560px; margin:0 auto; padding:24px 16px;">
    <div style="text-align:center; margin-bottom:16px;">
      <img src="${base}/logo-baytul-iqra.png" width="64" height="64" alt="Baytul Iqra Bookstore" style="border-radius:8px;">
      <div style="font-weight:700; color:#065f46; margin-top:6px;">Baytul Iqra Bookstore</div>
    </div>
    <div style="background:#ffffff; border-radius:12px; padding:24px;">
      <h1 style="font-size:22px; margin:0 0 8px;">${inShop ? 'Paid. Thank you!' : 'Thank you for your order!'}</h1>
      <p style="margin:0 0 16px; color:#374151;">${intro}</p>
      <table style="border-collapse:collapse; width:100%; font-size:15px;">${rows}
        <tr>
          <td style="padding:12px 0 0; font-weight:700;">Total <span style="font-weight:400; color:#6b7280; font-size:13px;">(tax included)</span></td>
          <td style="padding:12px 0 0; font-weight:700; text-align:right;">${money(total)}</td>
        </tr>
      </table>
      <p style="margin:16px 0 0; font-size:13px; color:#6b7280;">Order #${shortRef} &middot; ${orderDate}</p>
      ${
        addressLines.length
          ? `<p style="margin:16px 0 0; font-size:14px;"><b>Shipping to</b><br>${addressLines.map(escapeHtml).join('<br>')}</p>`
          : ''
      }
      <p style="text-align:center; margin:24px 0 8px;">
        <a href="${receiptUrl}" style="display:inline-block; background:#059669; color:#ffffff; text-decoration:none; padding:12px 22px; border-radius:8px; font-weight:600;">View your receipt</a>
      </p>
    </div>
    <p style="font-size:13px; color:#6b7280; text-align:center; margin:16px 0 0;">
      Questions? Reply to this email, or call or text 718-312-2048.<br>
      Thanks, Zein (Founder of Baytul Iqra)
    </p>
  </div>
</body>
</html>`;

  const text = [
    inShop ? 'Paid. Thank you!' : 'Thank you for your order!',
    intro,
    '',
    ...items.map((item) => `${item.title}  (Qty ${item.quantity} x ${money(item.price)})  ${money(item.price * item.quantity)}`),
    `Total: ${money(total)} (tax included)`,
    `Order #${shortRef} - ${orderDate}`,
    ...(addressLines.length ? ['', 'Shipping to:', ...addressLines] : []),
    '',
    `View your receipt: ${receiptUrl}`,
    '',
    'Questions? Reply to this email, or call or text 718-312-2048.',
    'Thanks, Zein (Founder of Baytul Iqra)',
  ].join('\n');

  return resend.emails.send({
    from: 'Baytul Iqra Bookstore <sales@baytuliqra.com>',
    replyTo: 'sales@baytuliqra.com',
    to,
    subject,
    html,
    text,
  });
}

const METHOD_LABELS: Record<string, string> = { apple_pay: 'Apple Pay', google_pay: 'Google Pay', card: 'Card', link: 'Link' };
const DEVICE_LABELS: Record<string, string> = { ios: 'iPhone / iPad', android: 'Android', desktop: 'Computer', other: 'Other device' };

/** Email to the shop when an order is paid: what sold, where, how it was paid, and what it earned. */
export async function sendOrderNotificationToSales({
  orderId,
  items,
  total,
  fulfillmentType,
  customerEmail,
  source,
  venue,
  paymentMethod,
  device,
  estimatedProfit,
  shippingAddress,
}: {
  orderId: string;
  items: { title: string; quantity: number; price: number }[];
  total: number;
  fulfillmentType: string;
  customerEmail: string;
  source?: string;
  venue?: string | null;
  paymentMethod?: string | null;
  device?: string | null;
  /** Revenue minus book cost, before card fees (undefined when no cost prices are known). */
  estimatedProfit?: number | null;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}) {
  const inShop = source === 'in-shop';
  const base = siteUrl();
  const shortRef = orderId.slice(-8).toUpperCase();
  const orderDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' });
  const bookNames = items.map((i) => i.title).join(', ');
  const subject = `${inShop ? `[In shop${venue ? ` · ${venue}` : ''}] ` : ''}New sale ${money(total)}: ${bookNames.length > 60 ? `${bookNames.slice(0, 57)}...` : bookNames}`;
  const adminUrl = `${base}/admin/orders`;

  const details: [string, string][] = [
    ['Order', `#${shortRef}`],
    ['When', `${orderDate} (Eastern)`],
    ['Channel', inShop ? 'In shop (QR scan)' : 'Online'],
    ...(venue ? ([['Venue', venue]] as [string, string][]) : []),
    ['Paid with', paymentMethod ? (METHOD_LABELS[paymentMethod] ?? paymentMethod) : 'Not recorded'],
    ...(device ? ([['Device', DEVICE_LABELS[device] ?? device]] as [string, string][]) : []),
    ['Customer email', customerEmail],
    ...(typeof estimatedProfit === 'number' ? ([['Est. profit (before card fees)', money(estimatedProfit)]] as [string, string][]) : []),
    ['Fulfillment', inShop ? 'Bought in shop (no pickup or shipping needed)' : fulfillmentType === 'pickup' ? 'Local pickup (Alpharetta, GA)' : 'Shipping'],
  ];
  const addressLines =
    fulfillmentType === 'shipping' && shippingAddress && typeof shippingAddress === 'object'
      ? ([shippingAddress.name, shippingAddress.line1, shippingAddress.line2, [shippingAddress.city, shippingAddress.state, shippingAddress.postal_code].filter(Boolean).join(', '), shippingAddress.country].filter(Boolean) as string[])
      : [];

  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:6px 0; border-bottom:1px solid #eee;">${escapeHtml(item.title)} <span style="color:#6b7280;">&times; ${item.quantity}</span></td>
        <td style="padding:6px 0; border-bottom:1px solid #eee; text-align:right;">${money(item.price * item.quantity)}</td>
      </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html><body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; color:#111827;">
  <div style="max-width:560px; margin:0 auto; padding:24px 16px;">
    <div style="background:#ffffff; border-radius:12px; padding:24px;">
      <div style="font-size:13px; color:#065f46; font-weight:700; text-transform:uppercase; letter-spacing:.04em;">${inShop ? 'In-shop sale' : 'New online order'}</div>
      <div style="font-size:32px; font-weight:800; margin:4px 0 12px;">${money(total)}</div>
      <table style="border-collapse:collapse; width:100%; font-size:14px; margin-bottom:16px;">
        ${details.map(([k, v]) => `<tr><td style="padding:3px 0; color:#6b7280; width:42%;">${escapeHtml(k)}</td><td style="padding:3px 0;">${escapeHtml(v)}</td></tr>`).join('')}
      </table>
      <table style="border-collapse:collapse; width:100%; font-size:15px;">${rows}</table>
      ${addressLines.length ? `<p style="font-size:14px; margin:16px 0 0;"><b>Ship to</b><br>${addressLines.map(escapeHtml).join('<br>')}</p>` : ''}
      <p style="font-size:14px; color:#374151; margin:16px 0 0;">${inShop ? 'The customer already has the book. Check the shelf count matches.' : 'Please process this order.'}</p>
      <p style="text-align:center; margin:20px 0 4px;"><a href="${adminUrl}" style="display:inline-block; background:#059669; color:#ffffff; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:600;">Open orders in admin</a></p>
      <p style="text-align:center; font-size:12px; color:#6b7280; margin:4px 0 0;">Search for #${shortRef}</p>
    </div>
  </div>
</body></html>`;

  const text = [
    `${inShop ? 'In-shop sale' : 'New online order'}: ${money(total)}`,
    ...details.map(([k, v]) => `${k}: ${v}`),
    '',
    ...items.map((i) => `${i.title} x ${i.quantity}  ${money(i.price * i.quantity)}`),
    ...(addressLines.length ? ['', 'Ship to:', ...addressLines] : []),
    '',
    `Orders in admin: ${adminUrl} (search #${shortRef})`,
  ].join('\n');

  return resend.emails.send({
    from: 'Baytul Iqra Sales <sales@baytuliqra.com>',
    to: 'sales@baytuliqra.com',
    subject,
    html,
    text,
  });
}

/** Alerts staff when payments pushed a book's stock below zero (two customers paid for the last copy). */
export async function sendOversellAlert({
  bookTitle,
  stock,
  orderId,
}: {
  bookTitle: string;
  stock: number;
  orderId: string;
}) {
  return resend.emails.send({
    from: 'sales@baytuliqra.com',
    to: 'sales@baytuliqra.com',
    subject: `Oversold: ${bookTitle}`,
    html: `
      <h2>Stock went negative</h2>
      <p><strong>${bookTitle}</strong> is now at <strong>${stock}</strong> after order <strong>${orderId}</strong>.</p>
      <p>Two customers likely paid for the last copy at the same time. Please check the shelf and refund or restock the affected order.</p>
    `,
  });
}


/** The end-of-day summary email to the shop. */
export async function sendDailySummaryEmail({ subject, html, text }: { subject: string; html: string; text: string }) {
  return resend.emails.send({
    from: 'Baytul Iqra Sales <sales@baytuliqra.com>',
    to: 'sales@baytuliqra.com',
    subject,
    html,
    text,
  });
}
