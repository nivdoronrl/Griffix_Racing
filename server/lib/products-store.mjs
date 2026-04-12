/**
 * products-store.mjs — read/write server/data/products.json
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const PRODUCTS_PATH = join(DATA_DIR, 'products.json');

export async function readProducts() {
  const raw = await readFile(PRODUCTS_PATH, 'utf-8');
  return JSON.parse(raw);
}

export async function writeProducts(products) {
  await writeFile(PRODUCTS_PATH, JSON.stringify(products, null, 2));
}
