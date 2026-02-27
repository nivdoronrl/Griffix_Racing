/**
 * orders.mjs — POST /api/orders, GET /api/orders (admin)
 */

import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { sendOrderNotification, sendCustomerConfirmation } from '../lib/mailer.mjs';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const ORDERS_FILE = join(__dirname, '../data/orders.json');

function readOrders() {
  try { return JSON.parse(readFileSync(ORDERS_FILE, 'utf8')); }
  catch { return []; }
}

function writeOrders(orders) {
  writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// ── POST /api/orders ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { customer, items, shipping, paymentMethod, subtotal } = req.body;

  // Basic validation
  if (!customer?.name || !customer?.email || !items?.length || !shipping) {
    return res.status(400).json({ error: 'Missing required order fields.' });
  }

  const total = parseFloat(subtotal || 0) + parseFloat(shipping?.amount || 0);

  const order = {
    orderId: `GRX-${uuidv4().substring(0, 8).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    customer,
    items,
    shipping,
    paymentMethod: paymentMethod || 'Not specified',
    subtotal: parseFloat(subtotal) || 0,
    total,
  };

  // Persist
  const orders = readOrders();
  orders.push(order);
  writeOrders(orders);

  // Send emails (non-blocking — don't fail order if email fails)
  Promise.allSettled([
    sendOrderNotification(order),
    sendCustomerConfirmation(order),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Email ${i === 0 ? 'owner' : 'customer'} failed:`, r.reason);
      }
    });
  });

  res.json({ success: true, orderId: order.orderId, total: order.total });
});

// ── GET /api/orders (admin protected) ────────────────────────────────────────
router.get('/', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const orders = readOrders();
  res.json(orders);
});

// ── PATCH /api/orders/:id (update status) ─────────────────────────────────────
router.patch('/:id', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { status } = req.body;
  const orders = readOrders();
  const order = orders.find(o => o.orderId === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  order.status = status;
  writeOrders(orders);
  res.json({ success: true, order });
});

export default router;
