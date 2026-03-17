import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const raw = readFileSync(join(process.cwd(), 'server/data/products.json'), 'utf-8');
    const products = JSON.parse(raw);
    res.status(200).json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Could not load products.' });
  }
}
