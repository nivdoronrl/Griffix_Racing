// POST /api/shippo/rates — kept for backward compatibility only.
// Shipping is a flat $20 (US); checkout no longer calls this and it no longer
// contacts Shippo (server/lib/shippo-client.mjs is left in place, unused here).
import { json } from '../_lib/http.js';

const FLAT = { object_id: 'flat-us', provider: 'Griffix', servicelevel: 'Flat Rate Shipping (US)', duration_terms: '', amount: '20.00', currency: 'USD' };

export function POST() {
  return json({ rates: [FLAT], messages: [] });
}
