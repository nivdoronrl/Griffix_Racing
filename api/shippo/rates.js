// POST /api/shippo/rates — live carrier rates for checkout.
// Port of server/routes/shippo.mjs; reuses server/lib/shippo-client.mjs as-is.
// Without SHIPPO_API_KEY checkout falls back to its built-in estimated rates.
import { json, readJson } from '../_lib/http.js';
import { getRates, deriveParcel } from '../../server/lib/shippo-client.mjs';

export async function POST(request) {
  const { toAddress, items } = (await readJson(request)) || {};
  if (!toAddress?.country || !items?.length) return json({ error: 'toAddress and items are required.' }, 400);
  if (!process.env.SHIPPO_API_KEY) return json({ error: 'Shipping not configured.' }, 503);
  try {
    const { rates, messages } = await getRates(toAddress, deriveParcel(items));
    return json({ rates, messages });
  } catch (err) {
    console.error('Shippo error:', err.message);
    return json({ error: 'Could not fetch shipping rates. Please try again.' }, 502);
  }
}
