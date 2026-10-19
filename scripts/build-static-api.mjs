#!/usr/bin/env node
/**
 * build-static-api.mjs — snapshot the catalog into static JSON served by the
 * Vercel CDN (vercel.json rewrites the old Render URLs onto these files):
 *
 *   GET /api/products        -> static-api/products.json        { products: [...] }
 *   GET /api/products/bikes  -> static-api/products/bikes.json  (bikes.json as-is)
 *   GET /api/gallery         -> static-api/gallery.json         { gallery: [...] sorted by order }
 *   GET /api/config          -> static-api/config.json
 *   GET /api/health          -> static-api/health.json
 *
 * Source of truth: server/data/{products,gallery,bikes}.json (main branch; it is a
 * superset of the shop-data branch as of 2026-10-19). Image paths stay
 * "uploads/<dir>/<file>" — vercel.json maps those to media/<dir>/<uuid>.webp.
 * Images with no WebP in media/ (see docs/MISSING_IMAGES.txt) are dropped from
 * the snapshot so the shop doesn't render broken thumbnails; the source JSON is
 * left untouched.
 *
 * Re-run after editing catalog data:  node scripts/build-static-api.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(readFileSync(join(ROOT, 'server', 'data', f), 'utf8'));
const out = (rel, data) => {
  const p = join(ROOT, 'static-api', rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data));
};

const webpFor = img => {
  const m = /^\/?uploads\/([^/]+)\/(.+)$/.exec(img || '');
  return m ? join(ROOT, 'media', m[1], basename(m[2], extname(m[2])) + '.webp') : null;
};
const dropped = [];
const keep = img => {
  if (/^https?:\/\//.test(img)) return true;
  const w = webpFor(img);
  if (w && existsSync(w)) return true;
  dropped.push(img);
  return false;
};

const products = read('products.json').map(p => ({ ...p, images: (p.images || []).filter(keep) }));
const gallery = read('gallery.json')
  .map(g => (g.image_url && !keep(g.image_url) ? { ...g, image_url: '' } : g))
  .sort((a, b) => a.order - b.order);

out('products.json', { products });
out('products/bikes.json', read('bikes.json'));
out('gallery.json', { gallery });
out('config.json', {
  paypalMeUrl: 'https://www.paypal.com/paypalme/GriffixRacing',
  zelleContact: 'nivdoron1@gmail.com',
  currency: 'USD',
});
out('health.json', { ok: true, static: true, builtAt: new Date().toISOString() });

// Prerendered PDPs embed the product JSON (images array); drop the same
// missing secondary images there. Primary images (og:image, <img>) all exist.
let patched = 0;
const missing = [...new Set(dropped)].filter(i => i.startsWith('uploads/products/'));
const pdpDir = join(ROOT, 'products');
if (missing.length && existsSync(pdpDir)) {
  for (const slug of readdirSync(pdpDir)) {
    const f = join(pdpDir, slug, 'index.html');
    if (!existsSync(f)) continue;
    let html = readFileSync(f, 'utf8');
    const before = html;
    for (const img of missing) {
      html = html.split(`,"${img}"`).join('').split(`"${img}",`).join('');
    }
    if (html !== before) { writeFileSync(f, html); patched++; }
  }
}

console.log(`static-api: ${products.length} products, ${gallery.length} gallery items; ` +
  `${dropped.length} image refs without a WebP dropped from the snapshot; ${patched} PDP pages patched`);
