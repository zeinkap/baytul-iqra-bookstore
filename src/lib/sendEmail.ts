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

export async function sendOrderNotificationToSales({
  orderId,
  items,
  total,
  fulfillmentType,
  customerEmail,
  source,
  shippingAddress,
}: {
  orderId: string;
  items: { title: string; quantity: number; price: number }[];
  total: number;
  fulfillmentType: string;
  customerEmail: string;
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
  const subject = `${inShop ? '[In shop] ' : ''}New Order #${orderId} - Baytul Iqra Bookstore`;
  const orderDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  let shippingAddressHtml = '';
  if (fulfillmentType === 'shipping' && shippingAddress && typeof shippingAddress === 'object') {
    const addr = shippingAddress;
    shippingAddressHtml = `<h3>Shipping Address</h3><p>${[addr.name, addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean).join('<br>')}</p>`;
  }

  const fulfillmentText = inShop
    ? '<p><strong>Fulfillment Type:</strong> In-shop purchase (QR scan). The customer already has the book, no pickup or shipping needed.</p>'
    : fulfillmentType === 'pickup' 
    ? '<p><strong>Fulfillment Type:</strong> Local Pickup (Alpharetta, GA)</p>'
    : '<p><strong>Fulfillment Type:</strong> Shipping</p>';

  const tableRows = items.map(item => `
    <tr>
      <td style="padding:4px 8px; border:1px solid #eee;">${item.title}</td>
      <td style="padding:4px 8px; border:1px solid #eee; text-align:center;">${item.quantity}</td>
      <td style="padding:4px 8px; border:1px solid #eee; text-align:right;">$${item.price.toFixed(2)}</td>
      <td style="padding:4px 8px; border:1px solid #eee; text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`).join('');

  const html = `
    <h2>New Order Received</h2>
    <p><strong>Order ID:</strong> ${orderId}</p>
    <p><strong>Order Date:</strong> ${orderDate}</p>
    <p><strong>Customer Email:</strong> ${customerEmail}</p>
    ${fulfillmentText}
    ${shippingAddressHtml}
    
    <h3>Order Summary</h3>
    <table style="border-collapse:collapse; width:100%; margin-bottom:12px;">
      <thead>
        <tr>
          <th style="padding:6px 8px; border:1px solid #eee; background:#f8f8f8;">Title</th>
          <th style="padding:6px 8px; border:1px solid #eee; background:#f8f8f8;">Quantity</th>
          <th style="padding:6px 8px; border:1px solid #eee; background:#f8f8f8; text-align:right;">Price</th>
          <th style="padding:6px 8px; border:1px solid #eee; background:#f8f8f8; text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <p><strong>Total:</strong> $${total.toFixed(2)}</p>
    
    <p>${inShop ? 'Please make sure the shelf count matches (the book has been taken by the customer).' : 'Please process this order accordingly.'}</p>
  `;

  return resend.emails.send({
    from: 'sales@baytuliqra.com',
    to: 'sales@baytuliqra.com',
    subject,
    html,
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
