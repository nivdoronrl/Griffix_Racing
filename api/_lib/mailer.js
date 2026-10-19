/**
 * mailer.js — transactional email for the Vercel Functions.
 * Ported from server/lib/mailer.mjs (Render). Same templates, same recipients.
 *
 * Transport, in order of preference:
 *   1. Resend  (RESEND_API_KEY)                 — what server/lib/mailer.mjs on Render uses
 *   2. SMTP    (SMTP_USER + SMTP_PASS [+ SMTP_HOST, SMTP_PORT]) — e.g. Gmail App Password
 * If neither is configured, mailConfigured() is false and sends are skipped (logged).
 *
 * Owner notifications go to OWNER_EMAIL (default griffixracing@gmail.com).
 * User-supplied values are HTML-escaped (the Render version interpolated raw).
 */
import { escapeHtml as e } from './http.js';

const OWNER = () => process.env.OWNER_EMAIL || 'griffixracing@gmail.com';
const RESEND_FROM_ORDERS  = () => process.env.MAIL_FROM_ORDERS  || 'Griffix Racing Orders <orders@griffixracing.com>';
const RESEND_FROM_DEFAULT = () => process.env.MAIL_FROM_DEFAULT || 'Griffix Racing <noreply@griffixracing.com>';

export function mailTransport() {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  return null;
}
export const mailConfigured = () => mailTransport() !== null;

let _smtp = null;
async function smtpTransporter() {
  if (_smtp) return _smtp;
  const nodemailer = (await import('nodemailer')).default;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  _smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _smtp;
}

async function send({ kind, to, replyTo, subject, html }) {
  const transport = mailTransport();
  if (!transport) {
    console.log('[mailer] No RESEND_API_KEY or SMTP_USER/SMTP_PASS — skipping send. Subject:', subject);
    return { skipped: true };
  }
  if (transport === 'resend') {
    const body = { from: kind === 'orders' ? RESEND_FROM_ORDERS() : RESEND_FROM_DEFAULT(), to, subject, html };
    if (replyTo) body.reply_to = replyTo;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    return res.json();
  }
  // SMTP (Gmail rewrites From to the authenticated account, so use it directly)
  const t = await smtpTransporter();
  const from = process.env.SMTP_FROM || `Griffix Racing <${process.env.SMTP_USER}>`;
  return t.sendMail({ from, to, replyTo, subject, html });
}

const money = n => `$${(parseFloat(n) || 0).toFixed(2)}`;
const shell = (title, inner, footer = '') => `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="background:#0f0f0f;margin:0;padding:32px;font-family:Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#181818;border:1px solid #2a2a2a;">
  <div style="background:#FF6B00;padding:20px 28px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:.06em;color:#0f0f0f;text-transform:uppercase;">${title}</h1>
  </div>
  <div style="padding:28px;">${inner}</div>
  ${footer ? `<div style="padding:16px 28px;border-top:1px solid #2a2a2a;"><p style="color:#444;font-size:11px;margin:0;">${footer}</p></div>` : ''}
</div></body></html>`;

export async function sendOrderNotification(order) {
  const a = order.shipping?.address || {};
  const rows = (order.items || []).map(i => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #222;font-size:14px;color:#ccc;">${e(i.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #222;text-align:center;color:#ccc;">${e(i.make || '')} ${e(i.model || '')} ${e(i.year || '')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #222;text-align:center;color:#ccc;">${e(i.qty)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #222;text-align:right;color:#FF6B00;">${money((parseFloat(i.price) || 0) * (parseInt(i.qty) || 0))}</td>
    </tr>`).join('');
  const h2 = t => `<h2 style="color:#fff;font-size:15px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #2a2a2a;padding-bottom:10px;">${t}</h2>`;
  const inner = `
    <p style="color:#aaa;font-size:14px;margin-top:0;">Order <strong style="color:#fff;">#${e(order.orderId)}</strong> received on ${e(new Date(order.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' }))} (ET).</p>
    ${h2('Customer')}
    <table style="width:100%;margin-bottom:24px;margin-top:10px;">
      <tr><td style="color:#777;font-size:13px;padding:4px 0;width:120px;">Name</td><td style="color:#e5e5e5;font-size:13px;">${e(order.customer.name)}</td></tr>
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Email</td><td style="color:#e5e5e5;font-size:13px;">${e(order.customer.email)}</td></tr>
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Phone</td><td style="color:#e5e5e5;font-size:13px;">${e(order.customer.phone || '—')}</td></tr>
    </table>
    ${h2('Ship To')}
    <p style="color:#e5e5e5;font-size:13px;margin:10px 0 24px;">
      ${e(a.street1)}${a.street2 ? ', ' + e(a.street2) : ''}<br>
      ${e(a.city)}, ${e(a.state)} ${e(a.zip)}<br>${e(a.country)}
    </p>
    ${h2('Items')}
    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
      <thead><tr style="background:#222;">
        <th style="padding:8px 12px;text-align:left;color:#777;font-size:12px;text-transform:uppercase;">Item</th>
        <th style="padding:8px 12px;text-align:center;color:#777;font-size:12px;text-transform:uppercase;">Fitment</th>
        <th style="padding:8px 12px;text-align:center;color:#777;font-size:12px;text-transform:uppercase;">Qty</th>
        <th style="padding:8px 12px;text-align:right;color:#777;font-size:12px;text-transform:uppercase;">Price</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>
    <table style="width:100%;margin-top:16px;">
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Subtotal</td><td style="text-align:right;color:#ccc;font-size:13px;">${money(order.subtotal)}</td></tr>
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Shipping${order.shipping?.service ? ' (' + e(order.shipping.service) + ')' : ''}</td><td style="text-align:right;color:#ccc;font-size:13px;">${money(order.shipping?.amount)}</td></tr>
      <tr><td style="color:#fff;font-size:15px;font-weight:700;padding:10px 0 0;">Total</td><td style="text-align:right;color:#FF6B00;font-size:18px;font-weight:700;padding:10px 0 0;">${money(order.total)}</td></tr>
    </table>
    <div style="background:#111;border:1px solid #2a2a2a;padding:16px;margin-top:28px;">
      <p style="color:#777;font-size:12px;margin:0 0 6px;text-transform:uppercase;">Payment Method</p>
      <p style="color:#e5e5e5;font-size:14px;margin:0;">${e(order.paymentMethod || 'Not specified')}</p>
    </div>
    ${order.stored === false ? '<p style="color:#FF6B00;font-size:12px;margin-top:20px;">Note: no order database is configured — this email is the only record of this order.</p>' : ''}`;
  return send({
    kind: 'orders', to: OWNER(), replyTo: order.customer.email,
    subject: `New Order #${order.orderId} — ${money(order.total)}`,
    html: shell('New Order — Griffix Racing', inner, 'Griffix Racing — Auto-generated order notification.'),
  });
}

export async function sendCustomerConfirmation(order) {
  const first = e(String(order.customer.name || '').split(' ')[0]);
  const inner = `
    <p style="color:#aaa;font-size:15px;margin-top:0;line-height:1.6;">Thanks ${first}! Your order <strong style="color:#FF6B00;">#${e(order.orderId)}</strong> has been received. We'll get it packed and shipped within 48 hours.</p>
    <div style="background:#111;border-left:3px solid #FF6B00;padding:16px 20px;margin:24px 0;">
      <p style="color:#aaa;font-size:13px;margin:0 0 8px;">Total due: <strong style="color:#fff;font-size:16px;">${money(order.total)}</strong></p>
      <p style="color:#aaa;font-size:13px;margin:0;">Please include order number <strong style="color:#FF6B00;">#${e(order.orderId)}</strong> as reference when paying.</p>
    </div>
    <p style="color:#666;font-size:12px;">Questions? Email us at <a href="mailto:orders@griffixracing.com" style="color:#FF6B00;">orders@griffixracing.com</a></p>`;
  return send({
    kind: 'orders', to: order.customer.email, replyTo: OWNER(),
    subject: `Order Confirmed — #${order.orderId} — Griffix Racing`,
    html: shell('Order Confirmed', inner),
  });
}

export async function sendTrackingUpdate(order) {
  const first = e(String(order.customer.name || '').split(' ')[0]);
  const block = order.trackingUrl
    ? `<a href="${e(order.trackingUrl)}" style="display:inline-block;margin-top:12px;padding:10px 22px;background:#FF6B00;color:#0f0f0f;font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;">Track Package →</a>`
    : `<p style="color:#e5e5e5;font-size:15px;font-weight:700;margin:8px 0 0;">${e(order.trackingNumber)}</p>`;
  const inner = `
    <p style="color:#aaa;font-size:15px;margin-top:0;line-height:1.6;">Hey ${first}! Your order <strong style="color:#FF6B00;">#${e(order.orderId)}</strong> is on its way.</p>
    <div style="background:#111;border-left:3px solid #FF6B00;padding:16px 20px;margin:24px 0;">
      <p style="color:#777;font-size:12px;margin:0 0 6px;text-transform:uppercase;">Tracking Number</p>${block}
    </div>
    <p style="color:#555;font-size:12px;margin:0;">Questions? Contact us at <a href="mailto:orders@griffixracing.com" style="color:#FF6B00;">orders@griffixracing.com</a></p>`;
  return send({
    kind: 'default', to: order.customer.email, replyTo: OWNER(),
    subject: `Your Order #${order.orderId} Has Shipped — Griffix Racing`,
    html: shell('Your Order Has Shipped!', inner, `Griffix Racing — Order #${e(order.orderId)}`),
  });
}

export async function sendContactNotification({ name, email, subject, message }) {
  const inner = `
    <table style="width:100%;margin-bottom:20px;">
      <tr><td style="color:#777;font-size:13px;padding:4px 0;width:100px;">From</td><td style="color:#e5e5e5;font-size:13px;">${e(name)} &lt;${e(email)}&gt;</td></tr>
      <tr><td style="color:#777;font-size:13px;padding:4px 0;">Subject</td><td style="color:#e5e5e5;font-size:13px;">${e(subject || '(no subject)')}</td></tr>
    </table>
    <div style="background:#111;border-left:3px solid #FF6B00;padding:16px 20px;">
      <p style="color:#ccc;font-size:14px;line-height:1.7;margin:0;white-space:pre-line;">${e(message)}</p>
    </div>
    <p style="color:#555;font-size:12px;margin-top:20px;">Reply directly to this email to respond to ${e(name)}.</p>`;
  return send({
    kind: 'default', to: OWNER(), replyTo: email,
    subject: `Contact: ${subject || name} — Griffix Racing`,
    html: shell('New Contact Form Message', inner),
  });
}
