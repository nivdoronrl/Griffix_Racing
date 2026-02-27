/**
 * sheets-client.mjs
 * Google Sheets API helper with a 60-second in-memory cache.
 *
 * Sheet tabs expected:
 *   "Products" — columns: id, name, category, make, model, year_from, year_to,
 *                          price, sku, image_url, description, in_stock, featured
 *   "Gallery"  — columns: id, tab, title, bike_make, bike_model, image_url,
 *                          customer_name, featured, order
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CREDS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './server/credentials.json';

let _auth = null;

function _getAuth() {
  if (_auth) return _auth;
  const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'));
  _auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return _auth;
}

// ── Cache ─────────────────────────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL_MS = 60_000;

async function _getSheet(tabName) {
  const now = Date.now();
  if (_cache.has(tabName)) {
    const { data, ts } = _cache.get(tabName);
    if (now - ts < CACHE_TTL_MS) return data;
  }

  const auth = _getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: tabName,
  });

  const [headers, ...rows] = res.data.values || [];
  const data = rows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h.trim(), (row[i] || '').trim()]))
  );

  _cache.set(tabName, { data, ts: now });
  return data;
}

// ── Public ────────────────────────────────────────────────────────────────
export async function getProducts() {
  const rows = await _getSheet('Products');
  return rows.map(r => ({
    ...r,
    price: parseFloat(r.price) || 0,
    year_from: parseInt(r.year_from) || null,
    year_to: parseInt(r.year_to) || null,
    in_stock: r.in_stock?.toLowerCase() === 'true',
    featured: r.featured?.toLowerCase() === 'true',
  }));
}

export async function getGallery() {
  const rows = await _getSheet('Gallery');
  return rows.map(r => ({
    ...r,
    featured: r.featured?.toLowerCase() === 'true',
    order: parseInt(r.order) || 999,
  }));
}

export function clearCache() {
  _cache.clear();
}
