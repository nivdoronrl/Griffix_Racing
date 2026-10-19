// POST /api/admin/login — port of server/routes/admin.mjs.
import { json, readJson, safeEqual } from '../_lib/http.js';

export async function POST(request) {
  const { password } = (await readJson(request)) || {};
  if (!password) return json({ error: 'Password required.' }, 400);
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SECRET) {
    return json({ error: 'Admin login is not configured on this deployment.' }, 503);
  }
  if (!safeEqual(String(password), process.env.ADMIN_PASSWORD)) {
    await new Promise(r => setTimeout(r, 500)); // uniform delay
    return json({ error: 'Incorrect password.' }, 401);
  }
  return json({ success: true, token: process.env.ADMIN_SECRET });
}
