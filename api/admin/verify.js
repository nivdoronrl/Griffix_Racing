// GET /api/admin/verify — port of server/routes/admin.mjs.
import { json, isAdmin } from '../_lib/http.js';

export function GET(request) {
  return isAdmin(request) ? json({ valid: true }) : json({ valid: false }, 401);
}
