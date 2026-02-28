import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Routes
import ordersRouter from './routes/orders.mjs';
import shippoRouter from './routes/shippo.mjs';
import sheetsRouter from './routes/sheets.mjs';
import contactRouter from './routes/contact.mjs';
import adminRouter from './routes/admin.mjs';
import productsRouter from './routes/products.mjs';
import galleryRouter from './routes/gallery.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Static files — serve the whole project root ────────────────────────────
app.use(express.static(ROOT));

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/orders', ordersRouter);
app.use('/api/shippo', shippoRouter);
app.use('/api/sheets', sheetsRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminRouter);
app.use('/api/products', productsRouter);
app.use('/api/gallery', galleryRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Public config (non-sensitive env vars for frontend) ───────────────────────
app.get('/api/config', (_req, res) => {
  res.json({
    paypalMeUrl: process.env.PAYPAL_ME_URL || '',
  });
});

// ── SPA fallback — serve index.html for unknown routes ───────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Griffix Racing server running at http://localhost:${PORT}`);
});
