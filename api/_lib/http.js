// Shared helpers for the Vercel Functions in /api (files under api/_lib are
// not deployed as functions themselves).

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export async function readJson(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

// Constant-time string compare so the admin token check doesn't leak timing.
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] || 0) ^ (eb[i] || 0);
  return diff === 0;
}

export function isAdmin(request) {
  return safeEqual(request.headers.get('x-admin-token') || '', process.env.ADMIN_SECRET || '');
}

export function lastPathSegment(request) {
  const parts = new URL(request.url).pathname.replace(/\/+$/, '').split('/');
  return decodeURIComponent(parts[parts.length - 1] || '');
}

export function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
