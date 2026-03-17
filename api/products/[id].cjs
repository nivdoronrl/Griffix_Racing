const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const raw = readFileSync(join(process.cwd(), 'server/data/products.json'), 'utf-8');
    const products = JSON.parse(raw);
    const product = products.find(p => p.id === req.query.id);
    if (!product) return res.status(404).json({ error: 'Not found.' });
    res.status(200).json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Could not load product.', detail: err.message });
  }
};
