/**
 * admin.mjs — POST /api/admin/login, GET /api/admin/verify
 */

import express from 'express';

const router = express.Router();

// ── POST /api/admin/login ──────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required.' });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    // Uniform delay to prevent timing attacks
    return setTimeout(() => {
      res.status(401).json({ error: 'Incorrect password.' });
    }, 500);
  }

  res.json({ success: true, token: process.env.ADMIN_SECRET });
});

// ── GET /api/admin/verify ─────────────────────────────────────────────────
router.get('/verify', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ valid: false });
  }
  res.json({ valid: true });
});

export default router;
