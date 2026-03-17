import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const raw = readFileSync(join(process.cwd(), 'server/data/bikes.json'), 'utf-8');
    res.status(200).json(JSON.parse(raw));
  } catch (err) {
    res.status(500).json({ error: 'Could not load bike catalog.' });
  }
}
