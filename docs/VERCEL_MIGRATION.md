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
| `POST /api/shippo/rates` | `api/shippo/rates.js` (reuses `server/lib/shippo-client.mjs`) |
| `POST /api/admin/login`, `GET /api/admin/verify` | `api/admin/*.js` |

`/api/config` returns `zelleContact: nivdoron1@gmail.com`.

`uploads/` is still in git (and still `.vercelignore`d). It is the source the WebPs are built from.

## Updating catalog data or images
1. Edit `server/data/products.json` / `gallery.json` / `bikes.json` and drop any new image into `uploads/<dir>/`.
2. `python3 scripts/convert-uploads-to-webp.py` (needs Pillow; incremental).
3. `node scripts/build-static-api.mjs`
4. Commit and open a PR. Merging to `main` deploys production.

## Environment variables (Vercel → Project → Settings → Environment Variables)
Names only. Set them for Production and Preview.

Email (one of these is required for the contact/quote form and order emails):
- `RESEND_API_KEY`: what the Render code (`server/lib/mailer.mjs`) actually uses. Sends from `orders@` / `noreply@griffixracing.com`, which must be a verified domain in Resend.
- or Gmail SMTP: `SMTP_USER`, `SMTP_PASS` (Gmail App Password), optional `SMTP_HOST` (default smtp.gmail.com), `SMTP_PORT` (default 465), `SMTP_FROM`.
- `OWNER_EMAIL`: optional, defaults to griffixracing@gmail.com.
- Optional: `MAIL_FROM_ORDERS`, `MAIL_FROM_DEFAULT` (Resend sender overrides).

Order storage (needed for order tracking and the admin Orders page):
- `KV_REST_API_URL` + `KV_REST_API_TOKEN`: Upstash Redis (free) via the Vercel Marketplace. The integration injects these automatically. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work.
- or `ORDERS_GITHUB_REPO` + `ORDERS_GITHUB_TOKEN` (+ optional `ORDERS_GITHUB_BRANCH`): a **private** repo, one file per order. A public repo is refused; this repo is public, so never point it here.
- With neither set, checkout still works and the owner email is the only record. That is effectively what happened on Render too: `orders.json` lived on its ephemeral disk and was never synced.
- With neither storage nor email set, `POST /api/orders` returns 503 so no order is silently lost.

Shipping: `SHIPPO_API_KEY`, `SHIPPO_FROM_NAME`, `SHIPPO_FROM_STREET`, `SHIPPO_FROM_CITY`, `SHIPPO_FROM_STATE`, `SHIPPO_FROM_ZIP`, `SHIPPO_FROM_COUNTRY`, `SHIPPO_FROM_PHONE`. Without them checkout shows its built-in estimated rates.

Admin: `ADMIN_PASSWORD`, `ADMIN_SECRET`.

No longer used on Vercel: `PAYPAL_ME_URL` and `ZELLE_CONTACT` (now static in `static-api/config.json`), `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_DATA_BRANCH` (shop-data sync), `GOOGLE_SHEET_ID`, `GOOGLE_CREDENTIALS_PATH` (`/api/sheets/*` is not used by any page), `PORT`, `DATA_DIR`, `UPLOADS_DIR`.

## Admin impact
- Works: login/verify, Orders list and status/tracking updates (needs order storage), tracking-number email to the customer.
- Broken: Products and Gallery create/edit/delete and image upload (`POST/PUT/DELETE /api/products…`, `/api/gallery…`). Those URLs are now static files, so writes fail and the admin UI shows an error. Vercel has no writable disk.
- Minimal option: edit the catalog in the repo (steps above) and deploy through a PR.
- Next step if in-browser editing is needed: a Vercel Function that commits `server/data/*.json` and uploaded images to `main` through the GitHub API (the old `lib/github-sync.mjs` approach, pointed at `main`). Each save then triggers a production redeploy. The alternative is Vercel Blob for images plus a KV/Blob catalog.

## Missing images
See `docs/MISSING_IMAGES.txt`. 52 files under `uploads/` are HTML error pages saved under an image name. No real version exists on any git branch, including `shop-data`. 36 are secondary images of 36 products and 1 is gallery item `g1`; the other 15 are not referenced. They are dropped from the static catalog JSON and the PDP embedded JSON. Every product still has its primary image.
