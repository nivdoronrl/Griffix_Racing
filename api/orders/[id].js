// PATCH /api/orders/:id (admin — update status, tracking, notes).
// Port of server/routes/orders.mjs.
import { json, readJson, isAdmin, lastPathSegment } from '../_lib/http.js';
import { storeBackend, getOrder, saveOrder } from '../_lib/orders-store.js';
import { sendTrackingUpdate } from '../_lib/mailer.js';

export async function PATCH(request) {
  if (!isAdmin(request)) return json({ error: 'Unauthorized.' }, 401);
  if (!storeBackend()) return json({ error: 'No order store configured on this deployment.' }, 503);

  const id = lastPathSegment(request);
  const body = (await readJson(request)) || {};
  const { status, trackingNumber, trackingUrl, notes } = body;

  const order = await getOrder(id).catch(() => null);
  if (!order) return json({ error: 'Order not found.' }, 404);

  const prevTracking = order.trackingNumber;
  if (status !== undefined) order.status = status;
  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber || null;
  if (trackingUrl !== undefined) order.trackingUrl = trackingUrl || null;
  if (notes !== undefined) order.notes = notes;
  order.updatedAt = new Date().toISOString();

  try { await saveOrder(order); }
  catch (err) { console.error('[orders] update failed:', err.message); return json({ error: 'Could not save order.' }, 502); }

  // Email customer when tracking is first added
  if (trackingNumber && !prevTracking) {
    await sendTrackingUpdate(order).catch(err => console.error('Tracking email failed:', err.message));
  }
  return json({ success: true, order });
}
