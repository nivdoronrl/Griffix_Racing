/**
* startup.mjs -- run once at server boot to ensure all required directories
* and data files exist. Supports Railway/Render persistent volumes via env
* vars, and also supports GitHub-based data persistence (see
* lib/github-sync.mjs) as a free alternative to a paid persistent disk:
*
* DATA_DIR -- where products.json / gallery.json / orders.json live
*   default: <server>/data
* UPLOADS_DIR -- where uploaded images live
*   default: <project-root>/uploads
*
* On boot, this script first tries to restore products.json / gallery.json /
* bikes.json from the GitHub data branch (the latest data saved by the admin
* panel -- see lib/github-sync.mjs). If GitHub sync isn't configured, or a
* file has genuinely never existed, it falls back to copying the committed
* defaults from this repo so the site still has data to show. It then
* restores any images referenced by that data that are missing locally.
*/

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { githubSyncEnabled, pullFromGitHub, pullBufferFromGitHub } from './lib/github-sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

export const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
export const UPLOADS_DIR = process.env.UPLOADS_DIR || join(projectRoot, 'uploads');

// Ensure upload / data directories exist
mkdirSync(join(UPLOADS_DIR, 'products'), { recursive: true });
mkdirSync(join(UPLOADS_DIR, 'gallery'), { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

if (!githubSyncEnabled()) {
  console.warn('[startup] GITHUB_TOKEN/GITHUB_REPO not set -- catalog data is stored on local disk only and WILL be lost on the next restart/redeploy unless a persistent disk is attached. See .env.example for free setup instructions.');
}

// Restore products.json / gallery.json / bikes.json -- prefer the latest
// version saved to GitHub; fall back to committed repo defaults only if
// GitHub sync isn't configured or the file has never been created yet.
const seeds = ['products.json', 'gallery.json', 'bikes.json'];

for (const filename of seeds) {
  const target = join(DATA_DIR, filename);
  const repoPath = `server/data/${filename}`;

const remote = await pullFromGitHub(repoPath);
  if (remote) {
    writeFileSync(target, remote);
    console.log(`[startup] Restored ${filename} from GitHub (${repoPath})`);
    continue;
  }

if (!existsSync(target)) {
  const source = join(__dirname, 'data', filename);
  if (existsSync(source)) {
    copyFileSync(source, target);
    console.log(`[startup] Seeded ${filename} from repo defaults (no GitHub sync configured)`);
  }
}
}

// Create orders.json if missing
const ordersPath = join(DATA_DIR, 'orders.json');
if (!existsSync(ordersPath)) {
  writeFileSync(ordersPath, '[]');
  console.log('[startup] Created empty orders.json');
}

// Restore any product/gallery images referenced in the data that are
// missing locally (e.g. uploaded through the admin panel since the last
// deploy, then wiped by a disk reset). Skipped entirely if GitHub sync
// isn't configured.
if (githubSyncEnabled()) {
  await restoreMissingImages();
}

async function restoreMissingImages() {
  const imagePaths = new Set();

try {
  const products = JSON.parse(readFileSync(join(DATA_DIR, 'products.json'), 'utf-8'));
  for (const p of products) {
    for (const img of (p.images || [])) imagePaths.add(img);
  }
} catch {}

try {
  const gallery = JSON.parse(readFileSync(join(DATA_DIR, 'gallery.json'), 'utf-8'));
  for (const g of gallery) {
    if (g.image_url && !g.image_url.startsWith('http')) imagePaths.add(g.image_url);
  }
} catch {}

let restored = 0;
  for (const relPath of imagePaths) {
    const localPath = join(UPLOADS_DIR, relPath.replace(/^uploads\//, ''));
    if (existsSync(localPath)) continue;

  const buf = await pullBufferFromGitHub(relPath);
    if (buf) {
      mkdirSync(dirname(localPath), { recursive: true });
      writeFileSync(localPath, buf);
      restored++;
    }
  }

if (restored > 0) {
  console.log(`[startup] Restored ${restored} missing image(s) from GitHub`);
}
}
