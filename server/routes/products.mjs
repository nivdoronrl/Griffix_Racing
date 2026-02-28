/**
 * products.mjs — /api/products
 *
 * Public:
 *   GET  /api/products          — list all
 *   GET  /api/products/bikes    — full bike catalog (makes/models/years)
 *   GET  /api/products/:id      — single product
 *
 * Admin-only (requires x-admin-token header):
 *   POST   /api/products              — create product (multipart or JSON)
 *   PUT    /api/products/:id          — update product (multipart or JSON)
 *   DELETE /api/products/:id          — delete product + its images
 *   DELETE /api/products/:id/images/:filename — remove one image
 */

import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { readProducts, writeProducts } from '../lib/products-store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const UPLOADS_DIR = join(ROOT, 'uploads', 'products');

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

const router = express.Router();

// ── Multer config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    cb(null, `${uuidv4()}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only images are accepted'), ok);
  },
});

// ── Auth middleware ────────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── GET /api/products/bikes ───────────────────────────────────────────────────
import { readFile } from 'fs/promises';
const BIKES_PATH = join(__dirname, '..', 'data', 'bikes.json');

router.get('/bikes', async (_req, res) => {
  try {
    const raw = await readFile(BIKES_PATH, 'utf-8');
    res.json(JSON.parse(raw));
  } catch (err) {
    res.status(500).json({ error: 'Could not load bike catalog.' });
  }
});

// ── GET /api/products ─────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const products = await readProducts();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Could not load products.' });
  }
});

// ── GET /api/products/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const products = await readProducts();
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found.' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Could not load product.' });
  }
});

// ── POST /api/products ────────────────────────────────────────────────────────
router.post('/', adminAuth, upload.array('images', 20), async (req, res) => {
  try {
    const products = await readProducts();
    const body = req.body;

    const product = {
      id: uuidv4(),
      sku: body.sku || '',
      name: body.name || 'Untitled Product',
      category: body.category || 'graphic-kit',
      make: body.make || '',
      model: body.model || '',
      year_from: body.year_from ? parseInt(body.year_from) : null,
      year_to: body.year_to ? parseInt(body.year_to) : null,
      price: parseFloat(body.price) || 0,
      description: body.description || '',
      images: (req.files || []).map(f => `uploads/products/${f.filename}`),
      in_stock: body.in_stock === 'true' || body.in_stock === true,
      featured: body.featured === 'true' || body.featured === true,
      created_at: new Date().toISOString(),
    };

    products.push(product);
    await writeProducts(products);
    res.status(201).json({ product });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/products/:id ─────────────────────────────────────────────────────
router.put('/:id', adminAuth, upload.array('images', 20), async (req, res) => {
  try {
    const products = await readProducts();
    const idx = products.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found.' });

    const body = req.body;
    const existing = products[idx];

    // New uploaded images get appended to existing ones
    const newImages = (req.files || []).map(f => `uploads/products/${f.filename}`);

    products[idx] = {
      ...existing,
      sku: body.sku ?? existing.sku,
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      make: body.make ?? existing.make,
      model: body.model ?? existing.model,
      year_from: body.year_from !== undefined ? (body.year_from ? parseInt(body.year_from) : null) : existing.year_from,
      year_to: body.year_to !== undefined ? (body.year_to ? parseInt(body.year_to) : null) : existing.year_to,
      price: body.price !== undefined ? (parseFloat(body.price) || 0) : existing.price,
      description: body.description ?? existing.description,
      images: [...existing.images, ...newImages],
      in_stock: body.in_stock !== undefined ? (body.in_stock === 'true' || body.in_stock === true) : existing.in_stock,
      featured: body.featured !== undefined ? (body.featured === 'true' || body.featured === true) : existing.featured,
    };

    await writeProducts(products);
    res.json({ product: products[idx] });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/products/:id ──────────────────────────────────────────────────
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const products = await readProducts();
    const idx = products.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found.' });

    const product = products[idx];

    // Delete associated image files
    for (const imgPath of product.images) {
      const fullPath = join(ROOT, imgPath);
      try { await unlink(fullPath); } catch {}
    }

    products.splice(idx, 1);
    await writeProducts(products);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/products/:id/images/:filename ─────────────────────────────────
router.delete('/:id/images/:filename', adminAuth, async (req, res) => {
  try {
    const products = await readProducts();
    const idx = products.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found.' });

    const filename = req.params.filename;
    const imgPath = `uploads/products/${filename}`;

    products[idx].images = products[idx].images.filter(i => i !== imgPath);
    await writeProducts(products);

    // Delete the file
    try { await unlink(join(ROOT, imgPath)); } catch {}

    res.json({ success: true, images: products[idx].images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
