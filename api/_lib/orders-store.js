/**
 * orders-store.js — persistent order storage for the Vercel Functions.
 *
 * On Render, orders lived in server/data/orders.json on the instance's
 * ephemeral disk (never synced to GitHub — it holds customer PII and the repo
 * is public), so they were wiped on every restart/redeploy. Vercel Functions
 * have no writable persistent disk at all, so pick one backend:
 *
 *  A) Upstash Redis REST (free tier; Vercel Marketplace "Upstash for Redis"
 *     injects these automatically):
 *       KV_REST_API_URL + KV_REST_API_TOKEN
 *       (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *  B) A PRIVATE GitHub repo, one JSON file per order (orders/<id>.json):
 *       ORDERS_GITHUB_REPO  ("owner/repo" — must be private; public repos are refused)
 *       ORDERS_GITHUB_TOKEN (fine-grained PAT, Contents: read/write on that repo only)
 *       ORDERS_GITHUB_BRANCH (optional, default "main")
 *
 * With neither configured, storeBackend() is null: checkout still works and
 * the owner email is the only record (same effective behaviour as Render),
 * but order tracking and the admin Orders page have nothing to show.
 */

function redisCfg() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}
function githubCfg() {
  const repo = process.env.ORDERS_GITHUB_REPO;
  const token = process.env.ORDERS_GITHUB_TOKEN;
  return repo && token ? { repo, token, branch: process.env.ORDERS_GITHUB_BRANCH || 'main' } : null;
}

export function storeBackend() {
  if (redisCfg()) return 'redis';
  if (githubCfg()) return 'github';
  return null;
}

// ── Redis (Upstash REST) ────────────────────────────────────────────────────
const HASH = 'griffix:orders';
async function redis(cmd) {
  const { url, token } = redisCfg();
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`Redis error ${res.status}: ${data.error || ''}`);
  return data.result;
}

// ── GitHub (private repo) ───────────────────────────────────────────────────
let _privacyChecked = false;
async function gh(path, options = {}) {
  const { token } = githubCfg();
  return fetch('https://api.github.com' + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'griffix-racing-orders',
      ...(options.headers || {}),
    },
  });
}
async function assertPrivateRepo() {
  if (_privacyChecked) return;
  const { repo } = githubCfg();
  const res = await gh(`/repos/${repo}`);
  if (!res.ok) throw new Error(`GitHub repo check failed (${res.status})`);
  const info = await res.json();
  if (!info.private) throw new Error('ORDERS_GITHUB_REPO is public — refusing to store customer data there');
  _privacyChecked = true;
}
const ghPath = id => `orders/${encodeURIComponent(id)}.json`;
async function ghGet(id) {
  const { repo, branch } = githubCfg();
  const res = await gh(`/repos/${repo}/contents/${ghPath(id)}?ref=${branch}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
  const data = await res.json();
  return { sha: data.sha, order: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) };
}
async function ghPut(order, sha) {
  const { repo, branch } = githubCfg();
  const body = {
    message: `${sha ? 'Update' : 'Add'} order ${order.orderId}`,
    content: Buffer.from(JSON.stringify(order, null, 2)).toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await gh(`/repos/${repo}/contents/${ghPath(order.orderId)}`, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GitHub write failed (${res.status}): ${await res.text()}`);
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function saveOrder(order) {
  const backend = storeBackend();
  if (backend === 'redis') return redis(['HSET', HASH, order.orderId, JSON.stringify(order)]);
  if (backend === 'github') {
    await assertPrivateRepo();
    const existing = await ghGet(order.orderId);
    return ghPut(order, existing?.sha);
  }
  throw new Error('No order store configured');
}

export async function getOrder(id) {
  const backend = storeBackend();
  if (backend === 'redis') {
    const raw = await redis(['HGET', HASH, id]);
    return raw ? JSON.parse(raw) : null;
  }
  if (backend === 'github') {
    await assertPrivateRepo();
    return (await ghGet(id))?.order || null;
  }
  return null;
}

export async function listOrders() {
  const backend = storeBackend();
  let orders = [];
  if (backend === 'redis') {
    const flat = (await redis(['HGETALL', HASH])) || [];
    for (let i = 1; i < flat.length; i += 2) {
      try { orders.push(JSON.parse(flat[i])); } catch {}
    }
  } else if (backend === 'github') {
    await assertPrivateRepo();
    const { repo, branch } = githubCfg();
    const res = await gh(`/repos/${repo}/contents/orders?ref=${branch}`);
    if (res.ok) {
      const files = (await res.json()).filter(f => f.name.endsWith('.json'));
      const got = await Promise.all(files.map(f => ghGet(decodeURIComponent(f.name.slice(0, -5))).catch(() => null)));
      orders = got.filter(Boolean).map(g => g.order);
    } else if (res.status !== 404) {
      throw new Error(`GitHub list failed (${res.status})`);
    }
  }
  return orders.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
