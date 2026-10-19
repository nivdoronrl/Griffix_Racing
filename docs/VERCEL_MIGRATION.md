# Running Griffix Racing on Vercel alone (no Render)

Render's free workspace was suspended (over 5 GB bandwidth), so every `/api/*` and
`/uploads/*` request on www.griffixracing.com returned 503. This branch serves
everything from the Vercel deployment. Render config (`server/`, `railway.toml`)
stays in place and is not used by Vercel.

## Why Render ran out of bandwidth
`/shop` rendered all ~1,485 product cards with eager `<img>` tags pointing at the
original PNG/JPGs. That is **~816 MB of images per full shop page load**, so a
handful of visits or one crawler pass used up the 5 GB.

## What serves what now

| URL | Served by |
|---|---|
| `/uploads/{products,gallery}/<uuid>.<png,jpg,jpeg>` | rewrite to `/media/<dir>/<uuid>.webp` (static, 1600px max, q78), `Cache-Control: public, max-age=31536000, immutable` |
| shop/templates/related-product cards | `/media/thumbs/<dir>/<uuid>.webp` (640px, q72), `loading="lazy"`, falls back to the full image |
| `GET /api/products`, `/api/products/bikes`, `/api/gallery`, `/api/config`, `/api/health` | rewrite to static JSON in `static-api/` (built by `scripts/build-static-api.mjs`) |
| `POST /api/contact` | Vercel Function `api/contact.js` |
| `POST /api/orders`, `GET /api/orders` (admin) | `api/orders/index.js` |
| `PATCH /api/orders/:id` (admin) | `api/orders/[id].js` |
| `GET /api/orders/track/:id?email=` | `api/orders/track/[id].js` |
| `POST /api/shippo/rates` | `api/shippo/rates.js` (returns the flat $20 rate; not called by checkout) |
| `POST /api/admin/login`, `GET /api/admin/verify` | `api/admin/*.js` |

`/api/config` returns `zelleContact: nivdoron1@gmail.com`.

`uploads/` is still in git (and still `.vercelignore`d). It is the source the WebPs are built from.

## Updating catalog data or images
1. Edit `server/data/products.json` / `gallery.json` / `bikes.json` and drop any new image into `uploads/<dir>/`.
2. `python3 scripts/convert-uploads-to-webp.py` (needs Pillow; incremental).
3. `node scripts/build-static-api.mjs`
4. Commit and open a PR. Merging to `main` deploys production.

## Decisions (2026-10-19)
- **Shipping: flat $20 (US).** Checkout shows a single "Flat Rate Shipping (US)" option at $20. `api/orders` forces `shipping.amount = 20` and computes `subtotal` from the line items, so `total = subtotal + 20` server-side whatever the client sends. No Shippo calls: `api/shippo/rates` returns the flat rate and `server/lib/shippo-client.mjs` is unused.
- **Order record: email.** No new accounts. Creating a Vercel Blob store wasn't possible: the Vercel connection gets 403 for this team. The owner email to `OWNER_EMAIL` includes the full order JSON. Order tracking replies "not available, see your confirmation email". The admin Orders page has no data until a store is configured (the Redis and private-GitHub backends stay in the code, off by default).
- **Email: Gmail SMTP as griffixracing@gmail.com** (preferred over Resend when both are set).
- **Admin login checks `ADMIN_USER` as well as `ADMIN_PASSWORD`.**

## Environment variables (Vercel → Project → Settings → Environment Variables)
Names only. Never commit values.

Required for the Preview test (and later Production):
- `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SECRET` (random, 48+ chars)
- `SMTP_USER` (griffixracing@gmail.com), `SMTP_PASS` (16-character Gmail App Password)
- Optional (the defaults are correct): `SMTP_HOST` (smtp.gmail.com), `SMTP_PORT` (465), `OWNER_EMAIL` (griffixracing@gmail.com), `SMTP_FROM`

To create the Gmail App Password: in the griffixracing@gmail.com Google Account, go to Security, turn on 2-Step Verification, then App passwords. Create one named "Griffix Vercel". It is 16 characters.

Optional, unused for now:
- `RESEND_API_KEY`
- `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `ORDERS_GITHUB_REPO` + `ORDERS_GITHUB_TOKEN` (order storage)

No longer used on Vercel: `SHIPPO_*`, `PAYPAL_ME_URL`, `ZELLE_CONTACT`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_DATA_BRANCH`, `GOOGLE_SHEET_ID`, `GOOGLE_CREDENTIALS_PATH`, `PORT`, `DATA_DIR`, `UPLOADS_DIR`.

## Admin impact
- Works: login (username + password) and verify. The Orders list, status/tracking updates and the tracking email need an order store, which isn't configured. Orders arrive by email instead.
- Broken: Products and Gallery create/edit/delete and image upload (`POST/PUT/DELETE /api/products…`, `/api/gallery…`). Those URLs are now static files, so writes fail and the admin UI shows an error. Vercel has no writable disk.
- Minimal option: edit the catalog in the repo (steps above) and deploy through a PR.
- Next step if in-browser editing is needed: a Vercel Function that commits `server/data/*.json` and uploaded images to `main` through the GitHub API (the old `lib/github-sync.mjs` approach, pointed at `main`). Each save then triggers a production redeploy. The alternative is Vercel Blob for images plus a KV/Blob catalog.

## Missing images
See `docs/MISSING_IMAGES.txt`. 52 files under `uploads/` are HTML error pages saved under an image name. No real version exists on any git branch, including `shop-data`. 36 are secondary images of 36 products and 1 is gallery item `g1`; the other 15 are not referenced. They are dropped from the static catalog JSON and the PDP embedded JSON. Every product still has its primary image.
