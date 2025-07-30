import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderConfirmationEmail({
  to,
  orderId,
  items,
  total,
  fulfillmentType,
  shippingAddress,
}: {
  to: string;
  orderId: string;
  items: { title: string; quantity: number; price: number }[];
  total: number;
  fulfillmentType: string;
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
  const subject = 'Your Baytul Iqra Bookstore Order Confirmation';
  const pickupText = fulfillmentType === 'pickup'
    ? `<p>Your order is ready for <b>free local pickup</b> in <b>Alpharetta, GA</b>. We'll contact you soon with pickup instructions.</p>`
    : `<p>Your order will be shipped to your address. You'll receive a confirmation email with tracking details soon.</p>`;

  const orderDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  let shippingAddressHtml = '';
  if (fulfillmentType === 'shipping' && shippingAddress && typeof shippingAddress === 'object') {
    const addr = shippingAddress;
    shippingAddressHtml = `<h3>Shipping Address</h3><p>${[addr.name, addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean).join('<br>')}</p>`;
  }
  const trackingNote = fulfillmentType === 'shipping'
    ? `<p style="margin-top:8px;">You'll receive another email with tracking information once your order ships.</p>`
    : '';
  const tableRows = items.map(item => `
    <tr>
      <td style="padding:4px 8px; border:1px solid #eee;">${item.title}</td>
      <td style="padding:4px 8px; border:1px solid #eee; text-align:center;">${item.quantity}</td>
      <td style="padding:4px 8px; border:1px solid #eee; text-align:right;">$${item.price.toFixed(2)}</td>
      <td style="padding:4px 8px; border:1px solid #eee; text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`).join('');
  const html = `
    <h2>Thank you for your order!</h2>
    ${pickupText}
    <p><b>Order Date:</b> ${orderDate}</p>
    ${shippingAddressHtml}
    ${trackingNote}
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
    <p><b>Total:</b> $${total.toFixed(2)} (tax included)</p>
    <p>Order ID: ${orderId}</p>
    <p>If you have any questions please give us a call or text at my personal number 718-312-2048.</p>
    <p>Thanks,<br>Zein (Founder of Baytul Iqra)</p>
  `;

  return resend.emails.send({
    from: 'sales@baytuliqra.com',
    to,
    subject,
    html,
  });
}

export async function sendOrderNotificationToSales({
  orderId,
  items,
  total,
  fulfillmentType,
  customerEmail,
  shippingAddress,
}: {
  orderId: string;
  items: { title: string; quantity: number; price: number }[];
  total: number;
  fulfillmentType: string;
  customerEmail: string;
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
  const subject = `New Order #${orderId} - Baytul Iqra Bookstore`;
  const orderDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  let shippingAddressHtml = '';
  if (fulfillmentType === 'shipping' && shippingAddress && typeof shippingAddress === 'object') {
    const addr = shippingAddress;
    shippingAddressHtml = `<h3>Shipping Address</h3><p>${[addr.name, addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean).join('<br>')}</p>`;
  }

  const fulfillmentText = fulfillmentType === 'pickup' 
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
    
    <p>Please process this order accordingly.</p>
  `;

  return resend.emails.send({
    from: 'sales@baytuliqra.com',
    to: 'sales@baytuliqra.com',
    subject,
    html,
  });
} 