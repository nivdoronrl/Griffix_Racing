/**
 * contact.mjs — POST /api/contact
 */

import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  if (!process.env.SMTP_USER) {
    // Dev mode: log and ack
    console.log('[Contact form]', { name, email, subject, message });
    return res.json({ success: true });
  }

  const transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const html = `
    <div style="font-family:sans-serif; background:#0f0f0f; padding:32px;">
      <div style="max-width:520px; margin:0 auto; background:#181818; border:1px solid #2a2a2a; padding:28px;">
        <h2 style="color:#D4FF00; margin-top:0;">Contact Form — Griffix Racing</h2>
        <p style="color:#aaa;"><strong style="color:#e5e5e5;">From:</strong> ${name} &lt;${email}&gt;</p>
        <p style="color:#aaa;"><strong style="color:#e5e5e5;">Subject:</strong> ${subject || '(no subject)'}</p>
        <p style="color:#aaa; white-space:pre-line;"><strong style="color:#e5e5e5;">Message:</strong><br>${message}</p>
      </div>
    </div>
  `;

  try {
    await transport.sendMail({
      from: `"Griffix Racing Contact" <${process.env.SMTP_USER}>`,
      to: process.env.OWNER_EMAIL,
      replyTo: email,
      subject: `Contact Form: ${subject || name}`,
      html,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Contact email error:', err.message);
    res.status(502).json({ error: 'Message could not be sent. Please try again.' });
  }
});

export default router;
