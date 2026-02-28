/**
 * gallery.mjs — /api/gallery
 *
 * Public:
 *   GET  /api/gallery          — list all
 *   GET  /api/gallery/:id      — single item
 *
 * Admin-only (x-admin-token required):
 *   POST   /api/gallery        — create (multipart: image field)
 *   PUT    /api/gallery/:id    — update (multipart: image field optional)
 *   DELETE /api/gallery/:id    — delete item + image file
 */

import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { readGallery, writeGallery } from '../lib/gallery-store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const UPLOADS_DIR = join(ROOT, 'uploads', 'gallery');

if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

const router = express.Router();

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
    cb(ok ? null : new Error('Only images accepted'), ok);
  },
});

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── GET /api/gallery ──────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const items = await readGallery();
    res.json({ gallery: items.sort((a, b) => a.order - b.order) });
  } catch {
    res.status(500).json({ error: 'Could not load gallery.' });
  }
});

// ── GET /api/gallery/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const items = await readGallery();
    const item = items.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found.' });
    res.json({ item });
  } catch {
    res.status(500).json({ error: 'Could not load item.' });
  }
});

// ── POST /api/gallery ─────────────────────────────────────────────────────────
router.post('/', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const items = await readGallery();
    const body = req.body;
    const maxOrder = items.length ? Math.max(...items.map(i => i.order || 0)) : 0;

    const item = {
      id: uuidv4(),
      tab: body.tab || 'our-designs',
      title: body.title || 'Untitled',
      bike_make: body.bike_make || '',
      bike_model: body.bike_model || '',
      image_url: req.file
        ? `uploads/gallery/${req.file.filename}`
        : (body.image_url || ''),
      customer_name: body.customer_name || '',
      featured: body.featured === 'true' || body.featured === true,
      order: parseInt(body.order) || maxOrder + 1,
      created_at: new Date().toISOString(),
    };

    items.push(item);
    await writeGallery(items);
    res.status(201).json({ item });
  } catch (err) {
    console.error('Gallery create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/gallery/:id ──────────────────────────────────────────────────────
router.put('/:id', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const items = await readGallery();
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found.' });

    const body = req.body;
    const existing = items[idx];

    // If a new image was uploaded, delete old file
    if (req.file && existing.image_url && !existing.image_url.startsWith('http')) {
      try { await unlink(join(ROOT, existing.image_url)); } catch {}
    }

    items[idx] = {
      ...existing,
      tab: body.tab ?? existing.tab,
      title: body.title ?? existing.title,
      bike_make: body.bike_make ?? existing.bike_make,
      bike_model: body.bike_model ?? existing.bike_model,
      image_url: req.file
        ? `uploads/gallery/${req.file.filename}`
        : (body.image_url ?? existing.image_url),
      customer_name: body.customer_name ?? existing.customer_name,
      featured: body.featured !== undefined
        ? (body.featured === 'true' || body.featured === true)
        : existing.featured,
      order: body.order !== undefined ? parseInt(body.order) : existing.order,
    };

    await writeGallery(items);
    res.json({ item: items[idx] });
  } catch (err) {
    console.error('Gallery update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/gallery/:id ───────────────────────────────────────────────────
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const items = await readGallery();
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found.' });

    const item = items[idx];
    if (item.image_url && !item.image_url.startsWith('http')) {
      try { await unlink(join(ROOT, item.image_url)); } catch {}
    }

    items.splice(idx, 1);
    await writeGallery(items);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
