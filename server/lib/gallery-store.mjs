import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GALLERY_PATH = join(__dirname, '..', 'data', 'gallery.json');

export async function readGallery() {
  const raw = await readFile(GALLERY_PATH, 'utf-8');
  return JSON.parse(raw);
}

export async function writeGallery(items) {
  await writeFile(GALLERY_PATH, JSON.stringify(items, null, 2));
}
