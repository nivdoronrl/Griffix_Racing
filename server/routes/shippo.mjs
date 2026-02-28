/**
 * shippo.mjs — POST /api/shippo/rates
 *
 * Body: { toAddress, items }
 * Returns: array of rate objects sorted cheapest-first
 */

import express from 'express';
import { getRates, deriveParcel } from '../lib/shippo-client.mjs';

const router = express.Router();

router.post('/rates', async (req, res) => {
  const { toAddress, items } = req.body;

  if (!toAddress?.country || !items?.length) {
    return res.status(400).json({ error: 'toAddress and items are required.' });
  }

  if (!process.env.SHIPPO_API_KEY) {
    return res.status(503).json({ error: 'Shipping not configured.' });
  }

  try {
    const parcel = deriveParcel(items);
    const { rates, messages } = await getRates(toAddress, parcel);
    res.json({ rates, messages });
  } catch (err) {
    console.error('Shippo error:', err.message);
    res.status(502).json({ error: 'Could not fetch shipping rates. Please try again.' });
  }
});

export default router;
