/**
 * startup.mjs — run once at server boot to ensure all required directories
 * and data files exist.  Supports Railway persistent volumes via env vars:
 *
 *   DATA_DIR    — where products.json / gallery.json / orders.json live
 *                 default: <server>/data
 *   UPLOADS_DIR — where uploaded images live
 *                 default: <project-root>/uploads
 *
 * On first deploy to Railway (when the volume is empty) this script copies
 * the committed JSON defaults into DATA_DIR so the site has data to show.
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

export const DATA_DIR    = process.env.DATA_DIR    || join(__dirname, 'data');
export const UPLOADS_DIR = process.env.UPLOADS_DIR || join(projectRoot, 'uploads');

// ── Ensure upload directories exist ──────────────────────────────────────────
mkdirSync(join(UPLOADS_DIR, 'products'), { recursive: true });
mkdirSync(join(UPLOADS_DIR, 'gallery'),  { recursive: true });

// ── Seed JSON data files from committed defaults (first-run only) ─────────────
const seeds = ['products.json', 'gallery.json', 'bikes.json'];

for (const filename of seeds) {
  const target  = join(DATA_DIR, filename);
  const source  = join(__dirname, 'data', filename);
  if (!existsSync(target) && existsSync(source)) {
    mkdirSync(DATA_DIR, { recursive: true });
    copyFileSync(source, target);
    console.log(`[startup] Seeded ${filename} from repo defaults`);
  }
}

// ── Create orders.json if missing ─────────────────────────────────────────────
const ordersPath = join(DATA_DIR, 'orders.json');
if (!existsSync(ordersPath)) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(ordersPath, '[]');
  console.log('[startup] Created empty orders.json');
}
