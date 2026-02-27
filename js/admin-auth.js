/**
 * admin-auth.js
 * Gate for all admin pages. Call initAdminAuth() at the top of each admin page.
 * If the sessionStorage token is missing or invalid, redirects to /admin/index.html.
 */

const ADMIN_TOKEN_KEY = 'griffix_admin_token';
const ADMIN_TOKEN_EXP_KEY = 'griffix_admin_token_exp';
const TOKEN_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export async function initAdminAuth() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const exp   = parseInt(sessionStorage.getItem(ADMIN_TOKEN_EXP_KEY) || '0');

  if (!token || Date.now() > exp) {
    _redirect();
    return null;
  }

  try {
    const res = await fetch('/api/admin/verify', {
      headers: { 'x-admin-token': token },
    });
    if (!res.ok) {
      _redirect();
      return null;
    }
    return token;
  } catch {
    _redirect();
    return null;
  }
}

export function saveToken(token) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_TOKEN_EXP_KEY, String(Date.now() + TOKEN_DURATION_MS));
}

export function clearToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_EXP_KEY);
}

export function getToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function _redirect() {
  if (!window.location.pathname.endsWith('/admin/index.html') &&
      !window.location.pathname.endsWith('/admin/')) {
    window.location.href = '/admin/index.html';
  }
}
