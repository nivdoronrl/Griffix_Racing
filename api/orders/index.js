// POST /api/orders (public checkout) and GET /api/orders (admin list).
// Port of server/routes/orders.mjs. Storage: see api/_lib/orders-store.js.
import { randomUUID } from 'node:crypto';
import { json, readJson, isAdmin } from '../_lib/http.js';
import { mailConfigured, sendOrderNotification, sendCustomerConfirmation } from '../_lib/mailer.js';
import { storeBackend, saveOrder, listOrders } from '../_lib/orders-store.js';

// Flat-rate shipping (must match FLAT_SHIPPING_RATE in checkout.html).
export const FLAT_SHIPPING = 20;

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

  // Server-side totals: subtotal from the line items, flat $20 shipping
  // regardless of what the client sent.
  const subtotalCalc = Math.round(items.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 0), 0) * 100) / 100;
  if (subtotal !== undefined && Math.abs((parseFloat(subtotal) || 0) - subtotalCalc) > 0.009) {
    console.warn('[orders] client subtotal', subtotal, 'differs from line items', subtotalCalc, '— using line items');
  }
  const shippingFinal = { ...shipping, provider: 'Griffix', servicelevel: 'Flat Rate Shipping (US)', amount: FLAT_SHIPPING.toFixed(2), currency: 'USD' };

  const now = new Date().toISOString();
  const order = {
    orderId: `GRX-${randomUUID().substring(0, 8).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    customer,
    items,
    shipping: shippingFinal,
    paymentMethod: paymentMethod || 'Not specified',
    subtotal: subtotalCalc,
    shippingAmount: FLAT_SHIPPING,
    total: Math.round((subtotalCalc + FLAT_SHIPPING) * 100) / 100,
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
  return json({ success: true, orderId: order.orderId, subtotal: order.subtotal, shipping: FLAT_SHIPPING, total: order.total });
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
