/**
* gallery-store.mjs -- read/write server/data/gallery.json
*
* Writes are also synced to GitHub (see lib/github-sync.mjs) so the gallery
* survives ephemeral filesystem resets on free hosting tiers. This is a
* no-op if GITHUB_TOKEN/GITHUB_REPO env vars aren't configured.
*/

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pushToGitHub } from './github-sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const GALLERY_PATH = join(DATA_DIR, 'gallery.json');
const REPO_PATH = 'server/data/gallery.json';

export async function readGallery() {
  const raw = await readFile(GALLERY_PATH, 'utf-8');
  return JSON.parse(raw);
}

export async function writeGallery(items) {
  const json = JSON.stringify(items, null, 2);
  await writeFile(GALLERY_PATH, json);

pushToGitHub(REPO_PATH, json, 'Update gallery.json via admin panel').catch(err => {
  console.error('[gallery-store] GitHub sync failed:', err.message);
});
}
