/**
 * sheets.mjs — GET /api/products, GET /api/gallery
 */

import express from 'express';
import { getProducts, getGallery } from '../lib/sheets-client.mjs';

const router = express.Router();

// ── GET /api/sheets/products ──────────────────────────────────────────────
router.get('/products', async (_req, res) => {
  if (!process.env.GOOGLE_SHEET_ID) {
    // Return placeholder data when Sheets isn't configured
    return res.json({ products: _placeholderProducts() });
  }
  try {
    const products = await getProducts();
    res.json({ products });
  } catch (err) {
    console.error('Sheets products error:', err.message);
    res.status(502).json({ error: 'Could not load products.' });
  }
});

// ── GET /api/sheets/gallery ───────────────────────────────────────────────
router.get('/gallery', async (_req, res) => {
  if (!process.env.GOOGLE_SHEET_ID) {
    return res.json({ gallery: _placeholderGallery() });
  }
  try {
    const gallery = await getGallery();
    res.json({ gallery });
  } catch (err) {
    console.error('Sheets gallery error:', err.message);
    res.status(502).json({ error: 'Could not load gallery.' });
  }
});

export default router;

// ── Placeholder data (used before Sheets is configured) ─────────────────
function _placeholderProducts() {
  return [
    { id: 'p1', name: 'KTM 250/350 SXF Stealth Kit', category: 'graphic-kit', make: 'KTM', model: '250/350 SXF', year_from: 2023, year_to: 2025, price: 249, sku: 'GRX-KTM-SXF-2325', image_url: '', description: 'Full graphic kit for KTM SXF, 3M laminate, UV rated.', in_stock: true, featured: true },
    { id: 'p2', name: 'Husqvarna FE 350 Coyote Kit', category: 'graphic-kit', make: 'Husqvarna', model: 'FE 350', year_from: 2023, year_to: 2025, price: 249, sku: 'GRX-HQV-FE350-2325', image_url: '', description: 'Enduro graphic kit with Coyote Tan colourway.', in_stock: true, featured: true },
    { id: 'p3', name: 'Yamaha YZ250F Acid Kit', category: 'graphic-kit', make: 'Yamaha', model: 'YZ250F', year_from: 2024, year_to: 2025, price: 229, sku: 'GRX-YAM-YZ250F-2425', image_url: '', description: 'Acid Lime signature kit for Yamaha YZ250F.', in_stock: true, featured: true },
    { id: 'p4', name: 'Honda CRF 450R Stealth Kit', category: 'graphic-kit', make: 'Honda', model: 'CRF 450R', year_from: 2021, year_to: 2024, price: 229, sku: 'GRX-HON-CRF450R-2124', image_url: '', description: 'Stealth Charcoal full kit for Honda CRF 450R.', in_stock: true, featured: true },
    { id: 'p5', name: 'KTM Gripper Seat Cover', category: 'seat-cover', make: 'KTM', model: '250/350 SXF', year_from: 2023, year_to: 2025, price: 89, sku: 'GRX-SC-KTM-SXF-2325', image_url: '', description: 'Gripper seat cover matched to Griffix graphic kits.', in_stock: true, featured: false },
    { id: 'p6', name: 'Universal Number Plate Kit', category: 'number-plate', make: '', model: 'Universal', year_from: null, year_to: null, price: 49, sku: 'GRX-NP-UNI', image_url: '', description: 'Custom printed number plates, set of 3.', in_stock: true, featured: false },
  ];
}

function _placeholderGallery() {
  return [
    { id: 'g1', tab: 'our-designs', title: 'Stealth KTM Build', bike_make: 'KTM', bike_model: 'EXC 300', image_url: '', customer_name: '', featured: true, order: 1 },
    { id: 'g2', tab: 'our-designs', title: 'Coyote Husqvarna', bike_make: 'Husqvarna', bike_model: 'TE 300i', image_url: '', customer_name: '', featured: true, order: 2 },
    { id: 'g3', tab: 'customer-builds', title: 'Jake\'s Race KTM', bike_make: 'KTM', bike_model: '350 SXF', image_url: '', customer_name: 'Jake K.', featured: true, order: 1 },
    { id: 'g4', tab: 'customer-builds', title: 'Sam\'s Woods Husqy', bike_make: 'Husqvarna', bike_model: 'FE 350', image_url: '', customer_name: 'Sam R.', featured: false, order: 2 },
    { id: 'g5', tab: 'plastic-kits', title: 'KTM Full Plastics', bike_make: 'KTM', bike_model: '250 SXF', image_url: '', customer_name: '', featured: true, order: 1 },
  ];
}
