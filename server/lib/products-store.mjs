/**
* products-store.mjs -- read/write server/data/products.json
*
* Writes are also synced to GitHub (see lib/github-sync.mjs) so the catalog
* survives ephemeral filesystem resets on free hosting tiers. This is a
* no-op if GITHUB_TOKEN/GITHUB_REPO env vars aren't configured.
*/

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pushToGitHub } from './github-sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const PRODUCTS_PATH = join(DATA_DIR, 'products.json');
const REPO_PATH = 'server/data/products.json';

export async function readProducts() {
  const raw = await readFile(PRODUCTS_PATH, 'utf-8');
  return JSON.parse(raw);
}

export async function writeProducts(products) {
  const json = JSON.stringify(products, null, 2);
  await writeFile(PRODUCTS_PATH, json);

pushToGitHub(REPO_PATH, json, 'Update products.json via admin panel').catch(err => {
  console.error('[products-store] GitHub sync failed:', err.message);
});
}
