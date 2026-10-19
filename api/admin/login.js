// POST /api/admin/login — { username, password } -> { token }.
// Port of server/routes/admin.mjs, plus a username check (ADMIN_USER).
import { json, readJson, safeEqual } from '../_lib/http.js';

export async function POST(request) {
  const { username, password } = (await readJson(request)) || {};
  if (!username || !password) return json({ error: 'Username and password required.' }, 400);
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_SECRET) {
    return json({ error: 'Admin login is not configured on this deployment.' }, 503);
  }
  // Evaluate both comparisons so timing doesn't reveal which one failed.
  const userOk = safeEqual(String(username), process.env.ADMIN_USER);
  const passOk = safeEqual(String(password), process.env.ADMIN_PASSWORD);
  if (!(userOk && passOk)) {
    await new Promise(r => setTimeout(r, 500)); // uniform delay
    return json({ error: 'Incorrect username or password.' }, 401);
  }
  return json({ success: true, token: process.env.ADMIN_SECRET });
}
