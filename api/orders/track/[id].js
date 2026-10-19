// GET /api/orders/track/:id?email=… (public customer lookup).
// Port of server/routes/orders.mjs — same safe public view.
import { json, lastPathSegment } from '../../_lib/http.js';
import { storeBackend, getOrder } from '../../_lib/orders-store.js';

export async function GET(request) {
  const id = lastPathSegment(request);
  const email = new URL(request.url).searchParams.get('email');
  if (!email) return json({ error: 'Email address is required.' }, 400);

  const notFound = () => json({ error: 'Order not found. Please check your Order ID and email address.' }, 404);
  if (!storeBackend()) return notFound();

  let order = null;
  try { order = await getOrder(id); } catch (err) { console.error('[track] lookup failed:', err.message); }
  if (!order || order.customer?.email?.toLowerCase() !== email.toLowerCase()) return notFound();

  return json({
    orderId: order.orderId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    status: order.status,
    customerName: order.customer.name,
    items: order.items,
    shipping: order.shipping,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    total: order.total,
    trackingNumber: order.trackingNumber || null,
    trackingUrl: order.trackingUrl || null,
  });
}
