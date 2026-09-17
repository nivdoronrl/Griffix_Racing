#!/usr/bin/env node
/**
 * Option A — build-time prerender for product PDPs + sitemaps.
 *
 * Reads server/data/products.json (requires unique `slug` on every product).
 * Writes:
 *   products/{slug}/index.html     — unique first-HTML SEO document
 *   product-id-to-slug.json         — id → slug map for legacy redirects
 *   sitemap-static.xml              — marketing pages
 *   sitemap-products.xml            — product locs (prefer in_stock)
 *   sitemap_index.xml               — index of the above
 *
 * Env:
 *   SAMPLE_ONLY=1   write only SAMPLE_COUNT pages (for local PR review commits)
 *   SAMPLE_COUNT=3  how many sample pages when SAMPLE_ONLY=1
 *   SAMPLE_SLUGS=a,b,c  optional explicit sample slug list
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignSlugs } from './ensure-product-slugs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.griffixracing.com';
const PRODUCTS_PATH = path.join(ROOT, 'server/data/products.json');
const OUT_DIR = path.join(ROOT, 'products');
const MAP_PATH = path.join(ROOT, 'product-id-to-slug.json');

const catLabels = {
  'graphic-kit': 'Graphic Kit',
  'seat-cover': 'Seat Cover',
  'plastic-kit': 'Plastic Kit',
  'number-plate': 'Number Plate',
  'accessory': 'Accessory',
};

const kitIncludes = {
  'graphic-kit': [
    'Front & rear fender graphics',
    'Side panels (left & right)',
    'Number plate backgrounds',
    'Fork protector graphics',
    'Swing arm decals',
    'Small detail decals',
  ],
  'seat-cover': [
    'Custom seat cover (gripper or standard finish)',
    'Printed to match graphic kit colours',
  ],
  'plastic-kit': [
    'Full plastic body kit',
    'Front fender',
    'Rear fender',
    'Side panels',
    'Number plates',
  ],
  default: ['All pieces as listed in product description'],
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, ' ');
}

function absUrl(u) {
  if (!u) return `${SITE}/brand_assets/Griffix%20logo.png`;
  if (/^https?:\/\//i.test(u)) return u;
  return `${SITE}/${String(u).replace(/^\//, '')}`;
}

function truncate(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd() + '…';
}

function metaDescription(p) {
  const fit = [p.make, p.model].filter(Boolean).join(' ');
  const years =
    p.year_from && p.year_to && p.year_from !== p.year_to
      ? `${p.year_from}–${p.year_to}`
      : p.year_from || p.year_to || '';
  const kit = catLabels[p.category] || 'MX graphics kit';
  const base =
    p.description ||
    `Buy the ${p.name} from Griffix Racing. ${fit} ${kit}${years ? ` (${years})` : ''}. Printed on Substance Inc. X1 UltraCurve with UltraCurve 1500 overlaminate.`;
  return truncate(base, 158);
}

function compatText(p) {
  return [
    p.model,
    p.year_from && p.year_to && p.year_from !== p.year_to
      ? `${p.year_from}–${p.year_to}`
      : p.year_from || p.year_to,
  ]
    .filter(Boolean)
    .join(' · ');
}

function renderPage(p) {
  const slug = p.slug;
  const canonical = `${SITE}/products/${slug}/`;
  const title = `${p.name} | Griffix Racing`;
  const desc = metaDescription(p);
  const primaryImg = p.images && p.images[0] ? absUrl(p.images[0]) : absUrl('brand_assets/Griffix logo.png');
  const imgAlt = `${p.name}${p.make || p.model ? ` — ${[p.make, p.model].filter(Boolean).join(' ')}` : ''} MX graphics`;
  const availability = p.in_stock
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';
  const price = Number(p.price);
  const catLabel = catLabels[p.category] || p.category || 'Product';
  const compat = compatText(p);
  const bodyDesc =
    p.description ||
    `Premium ${catLabel.toLowerCase()} for ${p.make || 'your bike'}${p.model ? ' ' + p.model : ''}${compat ? ' (' + compat + ')' : ''}. Engineered for hard enduro, motocross, and woods riding. Printed on Substance Inc. X1 UltraCurve print media with UltraCurve 1500 overlaminate, UV resistant.`;
  const includes = kitIncludes[p.category] || kitIncludes.default;
  const includesHtml = includes
    .map((i) => `<li style="margin-bottom:4px;">◆ ${escapeHtml(i)}</li>`)
    .join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: bodyDesc,
    image: [primaryImg],
    sku: p.sku || p.id,
    productID: p.id,
    brand: {
      '@type': 'Brand',
      name: 'Griffix Racing',
    },
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'USD',
      price: Number.isFinite(price) ? String(price) : undefined,
      availability,
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
  if (p.make) {
    jsonLd.category = catLabel;
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE}/shop` },
      ...(p.make
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: p.make,
              item: `${SITE}/shop`,
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: p.make ? 4 : 3,
        name: p.name,
        item: canonical,
      },
    ],
  };

  const productJson = JSON.stringify(p);
  const stockNote = p.in_stock
    ? `In stock · Dispatches within <strong style="color:#FF6B00;">48 hours</strong> of payment`
    : `<strong style="color:#aaa;">Currently sold out</strong> — check back soon`;

  const atcDisabled = p.in_stock
    ? ''
    : 'disabled style="opacity:0.4;cursor:not-allowed;"';
  const atcLabel = p.in_stock ? 'ADD TO CART' : 'SOLD OUT';

  const imgBlock =
    p.images && p.images.length
      ? `<img src="${escapeAttr('/' + String(p.images[0]).replace(/^\//, ''))}" alt="${escapeAttr(imgAlt)}" width="800" height="480" style="width:100%; height:100%; object-fit:cover; position:absolute; inset:0;">`
      : `<div class="absolute inset-0 flex items-center justify-center" id="main-img-placeholder">
            <span id="main-img-make" class="font-display font-bold select-none" style="font-size:72px; letter-spacing:-.04em; color:rgba(255,255,255,.07);">${escapeHtml((p.make || 'GRIFFIX').toUpperCase())}</span>
          </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(desc)}">
  <link rel="canonical" href="${escapeAttr(canonical)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Griffix Racing">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(desc)}">
  <meta property="og:url" content="${escapeAttr(canonical)}">
  <meta property="og:image" content="${escapeAttr(primaryImg)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title)}">
  <meta name="twitter:description" content="${escapeAttr(desc)}">
  <meta name="twitter:image" content="${escapeAttr(primaryImg)}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Archivo+Narrow:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            charcoal: { DEFAULT: '#2B2B2B', 700: '#353535', 800: '#1E1E1E', 900: '#141414' },
            orange: { DEFAULT: '#FF6B00', dark: '#e55a00' },
            tan: { DEFAULT: '#A39171', dark: '#7D6E56' }
          },
          fontFamily: {
            display: ['Oswald', 'sans-serif'],
            body: ['Archivo Narrow', 'sans-serif'],
          }
        }
      }
    }
  </script>
  <link rel="stylesheet" href="/shared/theme.css">
</head>
<body data-product-id="${escapeAttr(p.id)}" data-product-slug="${escapeAttr(slug)}">

<div id="nav-placeholder"></div>

<div id="product-content">

  <div style="padding-top:80px; background:#0a0a0a; border-bottom:1px solid rgba(163,145,113,.15); padding-bottom:14px;">
    <div class="max-w-7xl mx-auto px-6">
      <nav style="font-family:'Archivo Narrow',sans-serif; font-size:12px; color:#555; letter-spacing:.05em;">
        <a href="/" style="color:#555; text-decoration:none;" onmouseover="this.style.color='#FF6B00'" onmouseout="this.style.color='#555'">HOME</a>
        <span style="margin:0 8px;">›</span>
        <a href="/shop" style="color:#555; text-decoration:none;" onmouseover="this.style.color='#FF6B00'" onmouseout="this.style.color='#555'">SHOP</a>
        <span style="margin:0 8px;">›</span>
        <span id="breadcrumb-name" style="color:#A39171;">${escapeHtml(p.name)}</span>
      </nav>
    </div>
  </div>

  <section style="padding:48px 0 80px; background:#0f0f0f;">
    <div class="max-w-7xl mx-auto px-6">
      <div class="lg:grid lg:grid-cols-2 lg:gap-16">

        <div>
          <div id="main-img-wrap" class="relative overflow-hidden" style="height:480px; background:#1a1a1a; margin-bottom:12px;">
            <div class="absolute inset-0" style="background-image:radial-gradient(ellipse at 60% 40%, rgba(255,107,0,.05) 0%, transparent 55%);"></div>
            ${imgBlock}
            <div class="absolute inset-0" style="background:linear-gradient(to bottom, transparent 50%, rgba(15,15,15,.6) 100%); pointer-events:none;"></div>
            <div class="absolute bottom-0 left-0 right-0" style="height:3px; background:#FF6B00;"></div>
          </div>
          <div id="thumb-strip" class="flex gap-3" style="display:none !important;"></div>
        </div>

        <div style="padding-top:8px;">
          <div class="flex flex-wrap gap-2 mb-5">
            <span id="pd-category-badge" class="font-display text-xs font-bold tracking-widest" style="background:#2B2B2B; border:1px solid rgba(163,145,113,.45); color:#A39171; padding:4px 12px;">${escapeHtml(catLabel.toUpperCase())}</span>
            ${
              p.make
                ? `<span id="pd-make-badge" class="font-display text-xs font-bold tracking-widest" style="background:#2B2B2B; border:1px solid rgba(255,107,0,.35); color:#FF6B00; padding:4px 12px;">${escapeHtml(String(p.make).toUpperCase())}</span>`
                : `<span id="pd-make-badge" class="font-display text-xs font-bold tracking-widest" style="display:none; background:#2B2B2B; border:1px solid rgba(255,107,0,.35); color:#FF6B00; padding:4px 12px;"></span>`
            }
          </div>

          <h1 id="pd-name" class="font-display font-bold text-white mb-3" style="font-size:clamp(26px,4vw,42px); letter-spacing:-.02em; line-height:1.05;">${escapeHtml(p.name)}</h1>

          <div id="pd-compat" class="text-[#666] mb-5" style="font-family:'Archivo Narrow',sans-serif; font-size:14px;">${escapeHtml(compat)}</div>

          <div id="pd-price" class="font-display font-bold mb-6" style="font-size:36px; color:#FF6B00; letter-spacing:-.01em;">$${escapeHtml(String(p.price))}</div>

          <p id="pd-desc" class="text-[#909090] mb-8" style="font-family:'Archivo Narrow',sans-serif; line-height:1.8; font-size:15px;">${escapeHtml(bodyDesc)}</p>

          <div class="space-y-3 mb-8">
            <div class="flex items-start gap-3">
              <div class="check-icon mt-0.5"><svg width="12" height="12" fill="none" stroke="#0f0f0f" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
              <span style="font-family:'Archivo Narrow',sans-serif; font-size:14px; color:#ccc;">Substance Inc. X1 UltraCurve — FLO Technology, bubble-free, ultra-aggressive adhesion to LSE plastics</span>
            </div>
            <div class="flex items-start gap-3">
              <div class="check-icon mt-0.5"><svg width="12" height="12" fill="none" stroke="#0f0f0f" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
              <span style="font-family:'Archivo Narrow',sans-serif; font-size:14px; color:#ccc;">UV &amp; chemical resistant laminate — fuel, mud, and sun proof</span>
            </div>
            <div class="flex items-start gap-3">
              <div class="check-icon mt-0.5"><svg width="12" height="12" fill="none" stroke="#0f0f0f" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
              <span style="font-family:'Archivo Narrow',sans-serif; font-size:14px; color:#ccc;">Pre-cut to exact bike specification — no trimming required</span>
            </div>
            <div class="flex items-start gap-3">
              <div class="check-icon mt-0.5"><svg width="12" height="12" fill="none" stroke="#0f0f0f" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
              <span style="font-family:'Archivo Narrow',sans-serif; font-size:14px; color:#ccc;">Dispatched within 48 hours of payment confirmation</span>
            </div>
          </div>

          <div class="flex items-center gap-4 mb-6">
            <div class="qty-stepper">
              <button class="qty-btn" id="pd-dec" type="button">−</button>
              <span class="qty-display" id="pd-qty">1</span>
              <button class="qty-btn" id="pd-inc" type="button">+</button>
            </div>
            <button id="pd-atc-btn" class="btn-primary flex-1" type="button" style="padding:14px 24px; font-size:14px;" ${atcDisabled}>${atcLabel}</button>
          </div>

          <div style="background:#181818; border:1px solid rgba(163,145,113,.2); border-left:3px solid #A39171; padding:20px; margin-bottom:16px;">
            <h3 class="font-display text-[#A39171] font-bold text-xs tracking-widest uppercase mb-4">What's Included</h3>
            <ul id="pd-includes" style="color:#909090; font-family:'Archivo Narrow',sans-serif; font-size:14px; line-height:1.8; list-style:none; padding:0; margin:0;">${includesHtml}</ul>
          </div>

          <div style="background:#181818; border:1px solid rgba(255,107,0,.15); padding:14px 18px; display:flex; align-items:center; gap:12px;">
            <svg width="16" height="16" fill="none" stroke="#FF6B00" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            <span style="font-family:'Archivo Narrow',sans-serif; font-size:13px; color:#aaa;">${stockNote}</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section style="padding:64px 0; background:#141414;">
    <div class="max-w-7xl mx-auto px-6">
      <div class="label mb-4">More From Griffix</div>
      <h2 class="font-display font-bold text-white mb-10" style="font-size:clamp(28px,4vw,40px); letter-spacing:-.03em;">YOU MIGHT ALSO LIKE</h2>
      <div id="related-grid" class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"></div>
    </div>
  </section>

</div>

<div id="footer-placeholder"></div>

<script type="application/json" id="embedded-product">${productJson.replace(/</g, '\\u003c')}</script>
<script src="/js/reveal.js"></script>
<script src="/js/cart.js"></script>
<script src="/js/nav.js"></script>
<script>
const catLabels = ${JSON.stringify(catLabels)};
let _product = null;
let _qty = 1;
try {
  _product = JSON.parse(document.getElementById('embedded-product').textContent);
} catch (e) {
  console.error('Failed to parse embedded product', e);
}

function productHref(p) {
  if (p && p.slug) return '/products/' + encodeURIComponent(p.slug) + '/';
  return '/product.html?id=' + encodeURIComponent(p.id);
}

function renderRelated(products) {
  const grid = document.getElementById('related-grid');
  if (!products.length) { grid.closest('section').style.display = 'none'; return; }
  grid.innerHTML = products.map(p => \`
    <a href="\${productHref(p)}" class="product-card reveal shadow-card" style="display:block; text-decoration:none;">
      <div class="relative overflow-hidden" style="height:220px;">
        <div class="absolute inset-0" style="background:#1a1a1a; background-image:radial-gradient(ellipse at 60% 40%, rgba(255,107,0,.05) 0%, transparent 55%);"></div>
        \${p.images && p.images.length
          ? \`<img src="/\${p.images[0]}" alt="\${p.name}" class="w-full h-full object-cover absolute inset-0">\`
          : \`<div class="absolute inset-0 flex items-center justify-center"><span class="font-display font-bold text-white/10 select-none" style="font-size:44px; letter-spacing:-.03em;">\${(p.make||'KIT').toUpperCase()}</span></div>\`
        }
        <div class="absolute inset-0" style="background:linear-gradient(to bottom, transparent 40%, rgba(15,15,15,.9) 100%);"></div>
        <div class="absolute top-3 left-3 px-2 py-1" style="background:#2B2B2B; border:1px solid rgba(163,145,113,.45);">
          <span class="font-display text-xs font-bold tracking-widest" style="color:#A39171;">\${(p.make||'').toUpperCase()}</span>
        </div>
      </div>
      <div class="p-4">
        <div class="text-[#666] text-xs uppercase tracking-wider mb-1" style="font-family:'Archivo Narrow',sans-serif;">\${catLabels[p.category] || p.category}</div>
        <h3 class="font-display text-white font-bold text-base mb-3" style="letter-spacing:-.01em;">\${p.name}</h3>
        <div class="font-display text-[#FF6B00] font-bold" style="font-size:18px;">$\${p.price}</div>
      </div>
    </a>
  \`).join('');
}

async function hydrateRelated() {
  if (!_product) return;
  let allProducts = [];
  try {
    const r = await fetch('/api/products');
    const d = await r.json();
    allProducts = d.products || [];
  } catch { /* related is progressive enhancement */ }
  const related = allProducts
    .filter(p => p.id !== _product.id && (p.make === _product.make || p.category === _product.category))
    .slice(0, 4);
  renderRelated(related);
}

document.getElementById('pd-inc').addEventListener('click', () => {
  _qty++;
  document.getElementById('pd-qty').textContent = _qty;
});
document.getElementById('pd-dec').addEventListener('click', () => {
  if (_qty > 1) { _qty--; document.getElementById('pd-qty').textContent = _qty; }
});
document.getElementById('pd-atc-btn').addEventListener('click', () => {
  if (!_product || !_product.in_stock) return;
  window.Cart.addItem({
    id:        _product.sku || _product.id,
    productId: _product.id,
    name:      _product.name,
    make:      _product.make || '',
    model:     _product.model || '',
    year:      _product.year_to || _product.year_from || '',
    category:  _product.category,
    price:     _product.price,
    qty:       _qty,
    image:     (_product.images && _product.images[0]) ? '/' + _product.images[0] : '',
  });
});

hydrateRelated();
</script>
</body>
</html>
`;
}

function writeSitemapStatic() {
  const urls = [
    ['/', 'weekly', '1.0'],
    ['/shop', 'daily', '0.9'],
    ['/about', 'monthly', '0.7'],
    ['/gallery', 'weekly', '0.6'],
    ['/contact', 'monthly', '0.5'],
    ['/faq', 'monthly', '0.6'],
    ['/shipping', 'monthly', '0.5'],
    ['/installation', 'monthly', '0.7'],
    ['/templates', 'weekly', '0.6'],
    ['/order-tracking', 'yearly', '0.3'],
    ['/privacy', 'yearly', '0.2'],
    ['/terms', 'yearly', '0.2'],
    ['/cookies', 'yearly', '0.2'],
  ];
  const body = urls
    .map(
      ([loc, cf, pr]) => `  <url>
    <loc>${SITE}${loc}</loc>
    <changefreq>${cf}</changefreq>
    <priority>${pr}</priority>
  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap-static.xml'), xml);
}

function writeSitemapProducts(products) {
  // Prefer in_stock; if all are in stock (current catalog), include all with slug
  const indexable = products.filter((p) => p.slug && p.in_stock !== false);
  const body = indexable
    .map(
      (p) => `  <url>
    <loc>${SITE}/products/${p.slug}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap-products.xml'), xml);
  return indexable.length;
}

function writeSitemapIndex() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE}/sitemap-static.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${SITE}/sitemap-products.xml</loc>
  </sitemap>
</sitemapindex>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap_index.xml'), xml);
}

function selectSamples(products) {
  const explicit = (process.env.SAMPLE_SLUGS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (explicit.length) {
    return products.filter((p) => explicit.includes(p.slug));
  }
  const n = Number(process.env.SAMPLE_COUNT || 3);
  const featured = products.filter((p) => p.featured && p.in_stock);
  const pool = featured.length >= n ? featured : products.filter((p) => p.in_stock);
  return pool.slice(0, n);
}

function main() {
  const raw = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('products.json must be an array');

  // Validate / normalize slugs (does not write products.json)
  const products = assignSlugs(raw);
  const missing = products.filter((p) => !p.slug);
  if (missing.length) {
    throw new Error(`${missing.length} products missing slug — run ensure-product-slugs.mjs`);
  }

  const idToSlug = {};
  for (const p of products) idToSlug[p.id] = p.slug;
  fs.writeFileSync(MAP_PATH, JSON.stringify(idToSlug, null, 2) + '\n');
  console.log(`Wrote ${MAP_PATH} (${Object.keys(idToSlug).length} ids)`);

  const sampleOnly = process.env.SAMPLE_ONLY === '1' || process.argv.includes('--sample-only');
  const toWrite = sampleOnly ? selectSamples(products) : products;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // When doing a full build, clear previous generated pages (keep nothing stale)
  if (!sampleOnly) {
    for (const ent of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        fs.rmSync(path.join(OUT_DIR, ent.name), { recursive: true, force: true });
      }
    }
  }

  for (const p of toWrite) {
    const dir = path.join(OUT_DIR, p.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderPage(p));
  }
  console.log(
    `Wrote ${toWrite.length} product page(s)${sampleOnly ? ' (sample-only)' : ''} under products/`,
  );
  if (sampleOnly) {
    console.log('Samples:', toWrite.map((p) => p.slug).join(', '));
  }

  writeSitemapStatic();
  const productUrlCount = writeSitemapProducts(products);
  writeSitemapIndex();
  console.log(
    `Sitemaps: sitemap-static.xml, sitemap-products.xml (${productUrlCount} urls), sitemap_index.xml`,
  );
}

main();
