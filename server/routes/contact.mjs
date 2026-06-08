/**
 * contact.mjs — POST /api/contact
 */

import express from 'express';
import { sendContactNotification } from '../lib/mailer.mjs';

const router = express.Router();

router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
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
