/**
 * mailer.mjs
 * Nodemailer helper. Sends order confirmation emails.
 */

import nodemailer from 'nodemailer';

let _transport = null;

function _getTransport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transport;
}

/**
 * Send an order notification email to the shop owner.
 * @param {Object} order  — full order object from orders.mjs
 */
export async function sendOrderNotification(order) {
  const transport = _getTransport();

  const itemRows = order.items.map(i =>
    `<tr>
      <td style="padding:8px 12px; border-bottom:1px solid #222; font-family:'Helvetica',sans-serif; font-size:14px; color:#ccc;">${i.name}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #222; text-align:center; color:#ccc;">${i.make || ''} ${i.model || ''} ${i.year || ''}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #222; text-align:center; color:#ccc;">${i.qty}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #222; text-align:right; color:#D4FF00;">$${(i.price * i.qty).toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="background:#0f0f0f; margin:0; padding:32px; font-family:'Helvetica',sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:#181818; border:1px solid #2a2a2a;">

    <div style="background:#D4FF00; padding:20px 28px;">
      <h1 style="margin:0; font-size:22px; font-weight:700; letter-spacing:.06em; color:#0f0f0f; text-transform:uppercase;">New Order — Griffix Racing</h1>
    </div>

    <div style="padding:28px;">
      <p style="color:#aaa; font-size:14px; margin-top:0;">
        Order <strong style="color:#fff;">#${order.orderId}</strong> received on ${new Date(order.createdAt).toLocaleString('en-AU')}.
      </p>

      <h2 style="color:#fff; font-size:15px; text-transform:uppercase; letter-spacing:.08em; border-bottom:1px solid #2a2a2a; padding-bottom:10px; margin-bottom:0;">Customer</h2>
      <table style="width:100%; margin-bottom:24px; margin-top:10px;">
        <tr><td style="color:#777; font-size:13px; padding:4px 0; width:120px;">Name</td><td style="color:#e5e5e5; font-size:13px;">${order.customer.name}</td></tr>
        <tr><td style="color:#777; font-size:13px; padding:4px 0;">Email</td><td style="color:#e5e5e5; font-size:13px;">${order.customer.email}</td></tr>
        <tr><td style="color:#777; font-size:13px; padding:4px 0;">Phone</td><td style="color:#e5e5e5; font-size:13px;">${order.customer.phone || '—'}</td></tr>
      </table>

      <h2 style="color:#fff; font-size:15px; text-transform:uppercase; letter-spacing:.08em; border-bottom:1px solid #2a2a2a; padding-bottom:10px; margin-bottom:0;">Ship To</h2>
      <p style="color:#e5e5e5; font-size:13px; margin:10px 0 24px;">
        ${order.shipping.address.street1}${order.shipping.address.street2 ? ', ' + order.shipping.address.street2 : ''}<br>
        ${order.shipping.address.city}, ${order.shipping.address.state} ${order.shipping.address.zip}<br>
        ${order.shipping.address.country}
      </p>

      <h2 style="color:#fff; font-size:15px; text-transform:uppercase; letter-spacing:.08em; border-bottom:1px solid #2a2a2a; padding-bottom:10px; margin-bottom:0;">Items</h2>
      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <thead>
          <tr style="background:#222;">
            <th style="padding:8px 12px; text-align:left; color:#777; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.06em;">Item</th>
            <th style="padding:8px 12px; text-align:center; color:#777; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.06em;">Fitment</th>
            <th style="padding:8px 12px; text-align:center; color:#777; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.06em;">Qty</th>
            <th style="padding:8px 12px; text-align:right; color:#777; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.06em;">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <table style="width:100%; margin-top:16px;">
        <tr><td style="color:#777; font-size:13px; padding:4px 0;">Subtotal</td><td style="text-align:right; color:#ccc; font-size:13px;">$${order.subtotal.toFixed(2)}</td></tr>
        <tr><td style="color:#777; font-size:13px; padding:4px 0;">Shipping (${order.shipping.provider} ${order.shipping.servicelevel})</td><td style="text-align:right; color:#ccc; font-size:13px;">$${parseFloat(order.shipping.amount).toFixed(2)}</td></tr>
        <tr style="border-top:1px solid #2a2a2a;">
          <td style="color:#fff; font-size:15px; font-weight:700; padding:10px 0 0;">Total</td>
          <td style="text-align:right; color:#D4FF00; font-size:18px; font-weight:700; padding:10px 0 0;">$${order.total.toFixed(2)}</td>
        </tr>
      </table>

      <div style="background:#111; border:1px solid #2a2a2a; padding:16px; margin-top:28px;">
        <p style="color:#777; font-size:12px; margin:0 0 6px; text-transform:uppercase; letter-spacing:.06em;">Payment Method</p>
        <p style="color:#e5e5e5; font-size:14px; margin:0;">${order.paymentMethod || 'Not specified'}</p>
      </div>
    </div>

    <div style="padding:16px 28px; border-top:1px solid #2a2a2a;">
      <p style="color:#444; font-size:11px; margin:0;">Griffix Racing — Auto-generated order notification. Do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;

  await transport.sendMail({
    from: `"Griffix Racing Orders" <${process.env.SMTP_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject: `New Order #${order.orderId} — $${order.total.toFixed(2)}`,
    html,
  });
}

/**
 * Send order confirmation to the customer.
 */
export async function sendCustomerConfirmation(order) {
  const transport = _getTransport();

  const paypalUrl = process.env.PAYPAL_ME_URL
    ? `${process.env.PAYPAL_ME_URL}/${order.total.toFixed(2)}`
    : null;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="background:#0f0f0f; margin:0; padding:32px; font-family:'Helvetica',sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:#181818; border:1px solid #2a2a2a;">

    <div style="background:#D4FF00; padding:20px 28px;">
      <h1 style="margin:0; font-size:22px; font-weight:700; letter-spacing:.06em; color:#0f0f0f; text-transform:uppercase;">Order Confirmed</h1>
    </div>

    <div style="padding:28px;">
      <p style="color:#aaa; font-size:15px; margin-top:0; line-height:1.6;">
        Thanks ${order.customer.name.split(' ')[0]}! Your order <strong style="color:#D4FF00;">#${order.orderId}</strong> has been received.
        We'll get it packed and shipped within 48 hours.
      </p>

      <div style="background:#111; border-left:3px solid #D4FF00; padding:16px 20px; margin:24px 0;">
        <h2 style="color:#D4FF00; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; margin:0 0 12px;">Payment Instructions</h2>
        <p style="color:#aaa; font-size:13px; margin:0 0 8px;">Total due: <strong style="color:#fff; font-size:16px;">$${order.total.toFixed(2)} ${order.shipping.currency || 'AUD'}</strong></p>
        <p style="color:#aaa; font-size:13px; margin:0 0 4px;">Please pay via one of the following methods and include your order number <strong style="color:#D4FF00;">#${order.orderId}</strong> in the reference:</p>
        <ul style="color:#ccc; font-size:13px; margin:10px 0 0; padding-left:20px; line-height:1.8;">
          ${paypalUrl ? `<li>PayPal: <a href="${paypalUrl}" style="color:#D4FF00;">${paypalUrl}</a></li>` : ''}
          <li>Venmo: @GrifficRacing (send screenshot to confirm)</li>
          <li>Zelle: Contact us for details at ${process.env.OWNER_EMAIL}</li>
        </ul>
      </div>

      <p style="color:#666; font-size:12px;">Order will not be dispatched until payment is confirmed. Questions? Reply to this email or contact us at ${process.env.OWNER_EMAIL}.</p>
    </div>
  </div>
</body>
</html>
  `;

  await transport.sendMail({
    from: `"Griffix Racing" <${process.env.SMTP_USER}>`,
    to: order.customer.email,
    subject: `Order Confirmed — #${order.orderId} — Griffix Racing`,
    html,
  });
}
