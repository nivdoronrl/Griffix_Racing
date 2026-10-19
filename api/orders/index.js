// POST /api/orders (public checkout) and GET /api/orders (admin list).
// Port of server/routes/orders.mjs. Storage: see api/_lib/orders-store.js.
import { randomUUID } from 'node:crypto';
import { json, readJson, isAdmin } from '../_lib/http.js';
import { mailConfigured, sendOrderNotification, sendCustomerConfirmation } from '../_lib/mailer.js';
import { storeBackend, saveOrder, listOrders } from '../_lib/orders-store.js';

export async function POST(request) {
  const body = await readJson(request);
  const { customer, items, shipping, paymentMethod, subtotal } = body || {};

  if (!customer?.name || !customer?.email || !Array.isArray(items) || !items.length || !shipping) {
    return json({ error: 'Missing required order fields.' }, 400);
  }

  const backend = storeBackend();
  const canMail = mailConfigured();
  if (!backend && !canMail) {
    console.error('[orders] Neither an order store nor an email transport is configured — refusing order so it is not lost');
    return json({ error: 'Online ordering is temporarily unavailable. Please contact griffixracing@gmail.com.' }, 503);
  }

  const now = new Date().toISOString();
  const order = {
    orderId: `GRX-${randomUUID().substring(0, 8).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    customer,
    items,
    shipping,
    paymentMethod: paymentMethod || 'Not specified',
    subtotal: parseFloat(subtotal) || 0,
    total: (parseFloat(subtotal || 0) || 0) + (parseFloat(shipping?.amount || 0) || 0),
    trackingNumber: null,
    trackingUrl: null,
    notes: '',
  };

  let stored = false;
  if (backend) {
    try { await saveOrder(order); stored = true; }
    catch (err) { console.error('[orders] save failed:', err.message); }
  }
  if (!stored && !canMail) return json({ error: 'Order could not be saved. Please try again.' }, 502);

  const [owner, cust] = await Promise.allSettled([
    sendOrderNotification({ ...order, stored }),
    sendCustomerConfirmation(order),
  ]);
  if (owner.status === 'rejected') console.error('Email owner failed:', owner.reason?.message || owner.reason);
  if (cust.status === 'rejected') console.error('Email customer failed:', cust.reason?.message || cust.reason);

  // If the order wasn't stored and the owner email also failed, nobody has a record of it.
  if (!stored && owner.status === 'rejected') {
    return json({ error: 'Order could not be confirmed. Please try again or contact griffixracing@gmail.com.' }, 502);
  }
  return json({ success: true, orderId: order.orderId, total: order.total });
}

export async function GET(request) {
  if (!isAdmin(request)) return json({ error: 'Unauthorized.' }, 401);
  if (!storeBackend()) return json({ error: 'No order store configured on this deployment (see docs/VERCEL_MIGRATION.md).' }, 503);
  try {
    return json(await listOrders());
  } catch (err) {
    console.error('[orders] list failed:', err.message);
    return json({ error: 'Could not load orders.' }, 502);
  }
}
