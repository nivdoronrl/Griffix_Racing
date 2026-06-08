/**
 * mailer.mjs — Resend API helper for all transactional emails.
 */

const FROM_ORDERS  = 'Griffix Racing Orders <orders@griffixracing.com>';
const FROM_DEFAULT = 'Griffix Racing <noreply@griffixracing.com>';

async function resendSend({ from, to, replyTo, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[mailer] No RESEND_API_KEY — skipping send. Subject:', subject);
    return;
  }
  const body = { from, to, subject, html };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function sendOrderNotification(order) {
  const itemRows = order.items.map(i =>
    `<tr>
      <td style="padding:8px 12px; border-bottom:1px solid #222; font-family:Helvetica,sans-serif; font-size:14px; color:#ccc;">${i.name}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #222; text-align:center; color:#ccc;">${i.make || ''} ${i.model || ''} ${i.year || ''}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #222; text-align:center; color:#ccc;">${i.qty}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #222; text-align:right; color:#FF6B00;">$${(i.price * i.qty).toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="background:#0f0f0f;margin:0;padding:32px;font-family:Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#181818;border:1px solid #2a2a2a;">
  <div style="background:#FF6B00;padding:20px 28px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:.06em;color:#0f0f0f;text-transform:uppercase;">New Order — Griffix Racing</h1>
  </div>
  <div style="padding:28px;">
    <p style="color:#aaa;font-size:14px;margin-top:0;">Order <strong style="color:#fff;">#${order.orderId}</strong> received on ${new Date(order.createdAt).toLocaleString('en-AU')}.</p>
    <h2 style="color:#fff;font-size:15px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #2a2a2a;padding-bottom:10px;">Customer</h2>
    <table style="width:100%;margin-bottom:24px;margin-top:10px;">
      <tr><td style="color:#777;font-size:13px;padding:4px 0;width:120px;">Name</td><td style="color:#e5e5e5;font-size:13px;">${order.customer.name}</td></tr>
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Email</td><td style="color:#e5e5e5;font-size:13px;">${order.customer.email}</td></tr>
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Phone</td><td style="color:#e5e5e5;font-size:13px;">${order.customer.phone || '—'}</td></tr>
    </table>
    <h2 style="color:#fff;font-size:15px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #2a2a2a;padding-bottom:10px;">Ship To</h2>
    <p style="color:#e5e5e5;font-size:13px;margin:10px 0 24px;">
      ${order.shipping.address.street1}${order.shipping.address.street2 ? ', '+order.shipping.address.street2 : ''}<br>
      ${order.shipping.address.city}, ${order.shipping.address.state} ${order.shipping.address.zip}<br>
      ${order.shipping.address.country}
    </p>
    <h2 style="color:#fff;font-size:15px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #2a2a2a;padding-bottom:10px;">Items</h2>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
      <thead><tr style="background:#222;">
        <th style="padding:8px 12px;text-align:left;color:#777;font-size:12px;text-transform:uppercase;">Item</th>
        <th style="padding:8px 12px;text-align:center;color:#777;font-size:12px;text-transform:uppercase;">Fitment</th>
        <th style="padding:8px 12px;text-align:center;color:#777;font-size:12px;text-transform:uppercase;">Qty</th>
        <th style="padding:8px 12px;text-align:right;color:#777;font-size:12px;text-transform:uppercase;">Price</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table style="width:100%;margin-top:16px;">
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Subtotal</td><td style="text-align:right;color:#ccc;font-size:13px;">$${order.subtotal.toFixed(2)}</td></tr>
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Shipping</td><td style="text-align:right;color:#ccc;font-size:13px;">$${parseFloat(order.shipping.amount).toFixed(2)}</td></tr>
      <tr style="border-top:1px solid #2a2a2a;">
        <td style="color:#fff;font-size:15px;font-weight:700;padding:10px 0 0;">Total</td>
        <td style="text-align:right;color:#FF6B00;font-size:18px;font-weight:700;padding:10px 0 0;">$${order.total.toFixed(2)}</td>
      </tr>
    </table>
    <div style="background:#111;border:1px solid #2a2a2a;padding:16px;margin-top:28px;">
      <p style="color:#777;font-size:12px;margin:0 0 6px;text-transform:uppercase;">Payment Method</p>
      <p style="color:#e5e5e5;font-size:14px;margin:0;">${order.paymentMethod || 'Not specified'}</p>
    </div>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #2a2a2a;">
    <p style="color:#444;font-size:11px;margin:0;">Griffix Racing — Auto-generated order notification.</p>
  </div>
</div></body></html>`;

  await resendSend({
    from: FROM_ORDERS,
    to: process.env.OWNER_EMAIL || 'griffixracing@gmail.com',
    subject: `New Order #${order.orderId} — $${order.total.toFixed(2)}`,
    html,
  });
}

export async function sendTrackingUpdate(order) {
  const trackingBlock = order.trackingUrl
    ? `<a href="${order.trackingUrl}" style="display:inline-block;margin-top:12px;padding:10px 22px;background:#FF6B00;color:#0f0f0f;font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;">Track Package →</a>`
    : `<p style="color:#e5e5e5;font-size:15px;font-weight:700;margin:8px 0 0;">${order.trackingNumber}</p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="background:#0f0f0f;margin:0;padding:32px;font-family:Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#181818;border:1px solid #2a2a2a;">
  <div style="background:#FF6B00;padding:20px 28px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f0f0f;text-transform:uppercase;">Your Order Has Shipped!</h1>
  </div>
  <div style="padding:28px;">
    <p style="color:#aaa;font-size:15px;margin-top:0;line-height:1.6;">Hey ${order.customer.name.split(' ')[0]}! Your order <strong style="color:#FF6B00;">#${order.orderId}</strong> is on its way.</p>
    <div style="background:#111;border-left:3px solid #FF6B00;padding:16px 20px;margin:24px 0;">
      <p style="color:#777;font-size:12px;margin:0 0 6px;text-transform:uppercase;">Tracking Number</p>
      ${trackingBlock}
    </div>
    <p style="color:#555;font-size:12px;margin:0;">Questions? Contact us at <a href="mailto:orders@griffixracing.com" style="color:#FF6B00;">orders@griffixracing.com</a></p>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #2a2a2a;">
    <p style="color:#444;font-size:11px;margin:0;">Griffix Racing — Order #${order.orderId}</p>
  </div>
</div></body></html>`;

  await resendSend({
    from: FROM_DEFAULT,
    to: order.customer.email,
    subject: `Your Order #${order.orderId} Has Shipped — Griffix Racing`,
    html,
  });
}

export async function sendCustomerConfirmation(order) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="background:#0f0f0f;margin:0;padding:32px;font-family:Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#181818;border:1px solid #2a2a2a;">
  <div style="background:#FF6B00;padding:20px 28px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f0f0f;text-transform:uppercase;">Order Confirmed</h1>
  </div>
  <div style="padding:28px;">
    <p style="color:#aaa;font-size:15px;margin-top:0;line-height:1.6;">Thanks ${order.customer.name.split(' ')[0]}! Your order <strong style="color:#FF6B00;">#${order.orderId}</strong> has been received. We'll get it packed and shipped within 48 hours.</p>
    <div style="background:#111;border-left:3px solid #FF6B00;padding:16px 20px;margin:24px 0;">
      <p style="color:#aaa;font-size:13px;margin:0 0 8px;">Total due: <strong style="color:#fff;font-size:16px;">$${order.total.toFixed(2)}</strong></p>
      <p style="color:#aaa;font-size:13px;margin:0;">Please include order number <strong style="color:#FF6B00;">#${order.orderId}</strong> as reference when paying.</p>
    </div>
    <p style="color:#666;font-size:12px;">Questions? Email us at <a href="mailto:orders@griffixracing.com" style="color:#FF6B00;">orders@griffixracing.com</a></p>
  </div>
</div></body></html>`;

  await resendSend({
    from: FROM_ORDERS,
    to: order.customer.email,
    subject: `Order Confirmed — #${order.orderId} — Griffix Racing`,
    html,
  });
}

export async function sendContactNotification({ name, email, subject, message }) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="background:#0f0f0f;margin:0;padding:32px;font-family:Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#181818;border:1px solid #2a2a2a;">
  <div style="background:#FF6B00;padding:20px 28px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f0f0f;text-transform:uppercase;">New Contact Form Message</h1>
  </div>
  <div style="padding:28px;">
    <table style="width:100%;margin-bottom:20px;">
      <tr><td style="color:#777;font-size:13px;padding:4px 0;width:100px;">From</td><td style="color:#e5e5e5;font-size:13px;">${name} &lt;${email}&gt;</td></tr>
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Subject</td><td style="color:#e5e5e5;font-size:13px;">${subject || '(no subject)'}</td></tr>
    </table>
    <div style="background:#111;border-left:3px solid #FF6B00;padding:16px 20px;">
      <p style="color:#ccc;font-size:14px;line-height:1.7;margin:0;white-space:pre-line;">${message}</p>
    </div>
    <p style="color:#555;font-size:12px;margin-top:20px;">Reply directly to this email to respond to ${name}.</p>
  </div>
</div></body></html>`;

  await resendSend({
    from: FROM_DEFAULT,
    to: process.env.OWNER_EMAIL || 'griffixracing@gmail.com',
    replyTo: email,
    subject: `Contact: ${subject || name} — Griffix Racing`,
    html,
  });
}
