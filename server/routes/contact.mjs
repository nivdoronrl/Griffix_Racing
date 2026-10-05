/**
 * contact.mjs — POST /api/contact
 * Backward compatible: existing { name, email, subject, message } still works.
 * Optional honeypot field `website` (or `_gotcha`) is silently accepted.
 * Quote form reuses this endpoint by packing fields into `message`.
 */

import express from 'express';
import { sendContactNotification } from '../lib/mailer.mjs';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 12000;

router.post('/', async (req, res) => {
  const body = req.body || {};

  // Honeypot — pretend success so bots don't retry
  if ((body.website && String(body.website).trim()) || (body._gotcha && String(body._gotcha).trim())) {
    return res.json({ success: true });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (name.length > MAX_NAME || email.length > MAX_EMAIL || subject.length > MAX_SUBJECT || message.length > MAX_MESSAGE) {
    return res.status(400).json({ error: 'One or more fields exceed the length limit.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    await sendContactNotification({ name, email, subject, message });
    res.json({ success: true });
  } catch (err) {
    console.error('Contact email error:', err.message);
    res.status(502).json({ error: 'Message could not be sent. Please try again.' });
  }
});

export default router;
