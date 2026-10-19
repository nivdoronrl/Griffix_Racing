// POST /api/contact — contact form + /custom-graphics/ quote form.
// Port of server/routes/contact.mjs (same validation, honeypot, responses).
import { json, readJson } from './_lib/http.js';
import { sendContactNotification, mailConfigured } from './_lib/mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = { name: 120, email: 200, subject: 200, message: 12000 };

export async function POST(request) {
  const body = await readJson(request);
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request body.' }, 400);

  // Honeypot — pretend success so bots don't retry
  if ((body.website && String(body.website).trim()) || (body._gotcha && String(body._gotcha).trim())) {
    return json({ success: true });
  }

  const f = k => (typeof body[k] === 'string' ? body[k].trim() : '');
  const name = f('name'), email = f('email'), subject = f('subject'), message = f('message');

  if (!name || !email || !message) return json({ error: 'Name, email, and message are required.' }, 400);
  if (name.length > MAX.name || email.length > MAX.email || subject.length > MAX.subject || message.length > MAX.message) {
    return json({ error: 'One or more fields exceed the length limit.' }, 400);
  }
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);

  if (!mailConfigured()) {
    console.error('[contact] No email transport configured (RESEND_API_KEY or SMTP_USER/SMTP_PASS)');
    return json({ error: 'Message could not be sent. Please email griffixracing@gmail.com directly.' }, 503);
  }
  try {
    await sendContactNotification({ name, email, subject, message });
    return json({ success: true });
  } catch (err) {
    console.error('Contact email error:', err.message);
    return json({ error: 'Message could not be sent. Please try again.' }, 502);
  }
}
