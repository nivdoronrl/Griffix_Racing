/**
 * shippo-client.mjs
 * Calls Shippo REST API to get shipping rate estimates.
 * Applies a ×1.10 markup and returns rates sorted cheapest-first.
 *
 * Parcel dimensions are auto-calculated from the cart's product categories.
 */

const SHIPPO_API = 'https://api.goshippo.com';

// Parcel presets by category (mass kg, dims cm)
const PARCEL_PRESETS = {
  'graphic-kit':  { mass_value: '0.5', mass_unit: 'kg', length: '40', width: '30', height: '5',  distance_unit: 'cm' },
  'seat-cover':   { mass_value: '0.3', mass_unit: 'kg', length: '30', width: '25', height: '5',  distance_unit: 'cm' },
  'plastic-kit':  { mass_value: '2.0', mass_unit: 'kg', length: '60', width: '40', height: '20', distance_unit: 'cm' },
  'number-plate': { mass_value: '0.2', mass_unit: 'kg', length: '25', width: '15', height: '2',  distance_unit: 'cm' },
  'accessory':    { mass_value: '0.2', mass_unit: 'kg', length: '20', width: '15', height: '5',  distance_unit: 'cm' },
};

/**
 * Derive a single parcel from the cart items (max dims, sum weights).
 * @param {Array} items  — cart items with { category, qty }
 */
export function deriveParcel(items = []) {
  let mass = 0;
  let length = 0, width = 0, height = 0;

  for (const item of items) {
    const preset = PARCEL_PRESETS[item.category] || PARCEL_PRESETS['accessory'];
    mass += parseFloat(preset.mass_value) * (item.qty || 1);
    length = Math.max(length, parseFloat(preset.length));
    width  = Math.max(width,  parseFloat(preset.width));
    height = Math.max(height, parseFloat(preset.height));
  }

  if (mass === 0) mass = 0.5; // default

  return {
    mass_value: mass.toFixed(2),
    mass_unit: 'kg',
    length: String(length || 40),
    width:  String(width  || 30),
    height: String(height || 5),
    distance_unit: 'cm',
  };
}

/**
 * Fetch shipping rates for the given destination address and parcel.
 * @param {Object} toAddress  — { name, street1, city, state, zip, country, phone, email }
 * @param {Object} parcel     — result of deriveParcel() or custom dims
 * @returns {Array} rates sorted by amount_local ASC, with 10% markup applied
 */
export async function getRates(toAddress, parcel) {
  const fromAddress = {
    name:    process.env.SHIPPO_FROM_NAME    || 'Griffix Racing',
    street1: process.env.SHIPPO_FROM_STREET  || '',
    city:    process.env.SHIPPO_FROM_CITY    || '',
    state:   process.env.SHIPPO_FROM_STATE   || '',
    zip:     process.env.SHIPPO_FROM_ZIP     || '',
    country: process.env.SHIPPO_FROM_COUNTRY || 'AU',
    phone:   process.env.SHIPPO_FROM_PHONE   || '',
  };

  const body = {
    address_from: fromAddress,
    address_to: toAddress,
    parcels: [parcel],
    async: false,
  };

  const res = await fetch(`${SHIPPO_API}/shipments/`, {
    method: 'POST',
    headers: {
      'Authorization': `ShippoToken ${process.env.SHIPPO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shippo error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const successRates = (data.rates || []).filter(r => r.object_status === 'SUCCESS');

  return successRates
    .map(r => ({
      object_id:    r.object_id,
      provider:     r.provider,
      servicelevel: r.servicelevel?.name || r.servicelevel_name,
      duration_terms: r.duration_terms,
      amount:       (parseFloat(r.amount_local || r.amount) * 1.10).toFixed(2),
      currency:     r.currency_local || r.currency,
    }))
    .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
}
