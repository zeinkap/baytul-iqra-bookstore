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
  discount,
  paidAt,
  paymentMethod,
  paymentMethodDetail,
}: {
  to: string;
  orderId: string;
  items: { title: string; quantity: number; price: number }[];
  total: number;
  fulfillmentType: string;
  source?: string;
  /** Promo discount in dollars, shown as its own line when above zero */
  discount?: number | null;
  /** When the order was paid, so a resent receipt keeps the original date */
  paidAt?: Date | null;
  /** How the customer paid ("apple_pay", "card"...), shown as "Paid with" when known */
  paymentMethod?: string | null;
  /** Card or wallet detail ("Visa ending 4242"), preferred over the plain method name when known */
  paymentMethodDetail?: string | null;
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
  const orderDate = (paidAt ?? new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
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

  const paidWith = paymentMethodDetail || (paymentMethod ? METHOD_LABELS[paymentMethod] ?? paymentMethod.replace(/_/g, ' ') : null);

  const discountRow =
    discount && discount > 0.005
      ? `
        <tr>
          <td style="padding:8px 0; color:#047857;">Discount</td>
          <td style="padding:8px 0; text-align:right; color:#047857; white-space:nowrap;">-${money(discount)}</td>
        </tr>`
      : '';

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid #eee;">${escapeHtml(item.title)}<br><span style="color:#6b7280; font-size:13px;">Qty ${item.quantity} &times; ${money(item.price)}</span></td>
          <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right; white-space:nowrap;">${money(item.price * item.quantity)}</td>
        </tr>`
    )
    .join('') + discountRow;

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
      <p style="margin:16px 0 0; font-size:13px; color:#6b7280;">Order #${shortRef} &middot; ${orderDate}${paidWith ? ` &middot; Paid with ${escapeHtml(paidWith)}` : ''}</p>
      ${
        addressLines.length
          ? `<p style="margin:16px 0 0; font-size:14px;"><b>Shipping to</b><br>${addressLines.map(escapeHtml).join('<br>')}</p>`
          : ''
      }
      <p style="margin:16px 0 0; font-size:13px; color:#6b7280;">Need a refund, or something isn't right with your order? Just reply to this email.</p>
      <p style="text-align:center; margin:24px 0 8px;">
        <a href="${receiptUrl}" style="display:inline-block; background:#059669; color:#ffffff; text-decoration:none; padding:12px 22px; border-radius:8px; font-weight:600;">View your receipt</a>
      </p>
    </div>
    <p style="font-size:13px; color:#6b7280; text-align:center; margin:16px 0 0;">
      Questions? Just reply to this email.<br>
      Jazakum Allahu khayran,<br>Zein, Baytul Iqra
    </p>
  </div>
</body>
</html>`;

  const text = [
    inShop ? 'Paid. Thank you!' : 'Thank you for your order!',
    intro,
    '',
    ...items.map((item) => `${item.title}  (Qty ${item.quantity} x ${money(item.price)})  ${money(item.price * item.quantity)}`),
    ...(discount && discount > 0.005 ? [`Discount: -${money(discount)}`] : []),
    `Total: ${money(total)} (tax included)`,
    `Order #${shortRef} - ${orderDate}${paidWith ? ` - Paid with ${paidWith}` : ''}`,
    ...(addressLines.length ? ['', 'Shipping to:', ...addressLines] : []),
    '',
    "Need a refund, or something isn't right with your order? Just reply to this email.",
    '',
    `View your receipt: ${receiptUrl}`,
    '',
    'Questions? Just reply to this email.',
    'Jazakum Allahu khayran,',
    'Zein, Baytul Iqra',
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

/** Tells the customer a refund (full or partial) was issued. Replaces Stripe's own refund email. */
export async function sendRefundEmail({
  to,
  orderId,
  refundAmount,
  totalRefunded,
  orderTotal,
  paymentMethod,
  refundedTo,
  items,
  paidAt,
  refundReference,
}: {
  to: string;
  orderId: string;
  /** This refund only, in dollars */
  refundAmount: number;
  /** Everything refunded on the order so far, in dollars */
  totalRefunded: number;
  orderTotal: number;
  paymentMethod?: string | null;
  /** What the money goes back to, e.g. "Visa ending 4242" or "Apple Pay (Visa ending 4242)", when Stripe told us */
  refundedTo?: string | null;
  /** The books on the order */
  items?: { title: string; quantity: number }[];
  /** When the order was paid, shown as the purchase date */
  paidAt?: Date | null;
  /** Stripe's refund id and, for cards, the bank's reference (ARN) once the bank has issued it */
  refundReference?: { id?: string | null; bankReference?: string | null } | null;
}) {
  const shortRef = orderId.slice(-8).toUpperCase();
  const full = totalRefunded >= orderTotal - 0.005;
  const wallet = paymentMethod === 'apple_pay' || paymentMethod === 'google_pay';
  const where = refundedTo ? `your ${refundedTo}` : wallet ? 'your original payment method' : 'your original card';
  const itemLines = (items ?? []).map((i) => (i.quantity > 1 ? `${i.title} (x${i.quantity})` : i.title));
  const itemsHeading = full ? 'Refunded items' : 'Items on this order';
  const itemsHtml = itemLines.length
    ? `<p style="margin:16px 0 0; font-size:14px; color:#374151;"><b>${itemsHeading}</b><br>${itemLines.map(escapeHtml).join('<br>')}</p>`
    : '';
  const intro = `We've refunded ${money(refundAmount)} to ${where}. It usually shows up within 5-10 business days, depending on your bank. If you don't see it after 10 business days, please contact your bank or reply to this email.`;
  const detail = full
    ? 'This order has now been refunded in full.'
    : `So far ${money(totalRefunded)} of your ${money(orderTotal)} order has been refunded.`;
  const purchaseDate = paidAt?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  const remaining = Math.max(0, orderTotal - totalRefunded);
  // Only partial refunds need the running totals; a full refund is just the one amount
  const summary: [string, string][] = full
    ? [['Refund', money(refundAmount)]]
    : [['Order total', money(orderTotal)], ['This refund', money(refundAmount)], ['Refunded so far', money(totalRefunded)], ['Remaining', money(remaining)]];
  const references: [string, string][] = [];
  if (refundReference?.id) references.push(['Refund reference', refundReference.id]);
  if (refundReference?.bankReference) references.push(['Bank reference (ARN)', refundReference.bankReference]);
  const summaryHtml = summary
    .map(
      ([label, value], i) => `
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid #eee;">${label}</td>
          <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right; ${i === summary.length - 1 || full ? 'font-weight:700;' : ''}">${value}</td>
        </tr>`
    )
    .join('');
  const referencesHtml = references.length
    ? `<p style="margin:16px 0 0; font-size:13px; color:#6b7280;">${references.map(([l, v]) => `${l}: <span style="font-family:monospace; color:#374151;">${escapeHtml(v)}</span>`).join('<br>')}<br>Your bank may ask for this if the refund is late.</p>`
    : '';
  const subject = `Your Baytul Iqra refund, ${money(refundAmount)}`;
  const base = siteUrl();

  const html = `<!doctype html>
<html>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; color:#111827;">
  <div style="max-width:560px; margin:0 auto; padding:24px 16px;">
    <div style="text-align:center; margin-bottom:16px;">
      <img src="${base}/logo-baytul-iqra.png" width="64" height="64" alt="Baytul Iqra Bookstore" style="border-radius:8px;">
      <div style="font-weight:700; color:#065f46; margin-top:6px;">Baytul Iqra Bookstore</div>
    </div>
    <div style="background:#ffffff; border-radius:12px; padding:24px;">
      <h1 style="font-size:22px; margin:0 0 8px;">Your refund is on its way</h1>
      <p style="margin:0 0 16px; color:#374151;">${intro}</p>
      <table style="border-collapse:collapse; width:100%; font-size:15px;">${summaryHtml}
      </table>
      <p style="margin:16px 0 0; font-size:14px; color:#374151;">${detail}</p>${itemsHtml}
      <p style="margin:16px 0 0; font-size:13px; color:#6b7280;">Order #${shortRef}${purchaseDate ? ` &middot; Purchased ${purchaseDate}` : ''}</p>${referencesHtml}
    </div>
    <p style="font-size:13px; color:#6b7280; text-align:center; margin:16px 0 0;">
      Questions? Just reply to this email.<br>
      We're sorry it didn't work out, and thank you for giving us a try.<br>Zein, Baytul Iqra
    </p>
  </div>
</body>
</html>`;

  const text = [
    'Your refund is on its way',
    intro,
    '',
    ...summary.map(([label, value]) => `${label}: ${value}`),
    detail,
    ...(itemLines.length ? ['', `${itemsHeading}:`, ...itemLines] : []),
    '',
    `Order #${shortRef}${purchaseDate ? ` - Purchased ${purchaseDate}` : ''}`,
    ...references.map(([label, value]) => `${label}: ${value}`),
    ...(references.length ? ['Your bank may ask for this if the refund is late.'] : []),
    '',
    'Questions? Just reply to this email.',
    "We're sorry it didn't work out, and thank you for giving us a try.",
    'Zein, Baytul Iqra',
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
