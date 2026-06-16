// Scrape MX Graphics (supplier) and refresh product images where a confident
// make+design match exists. Overwrites the existing image file in-place so
// products.json paths stay intact. Dry-run by default; pass --apply to write.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const APPLY = process.argv.includes("--apply");
const IMPORT = process.argv.includes("--import");
const ROOT = path.resolve(".");
const PRODUCTS = path.join(ROOT, "server/data/products.json");
const UPLOADS = path.join(ROOT, "uploads/products");

const STOP = new Set(["graphic", "kit", "for", "the", "full", "series", "graphics", "s"]);
const makeAlias = { gasgas: "gasgas", gas: "gasgas", husky: "husqvarna" };
const norm = (t) =>
  t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .map((w) => makeAlias[w] || w).filter((w) => w && !STOP.has(w));
const sim = (a, b) => {
  const A = new Set(a), B = new Set(b);
  let i = 0; A.forEach((x) => { if (B.has(x)) i++; });
  return i / (A.size + B.size - i);
};

async function fetchCatalog() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const r = await fetch(`https://mxgraphics.co/products.json?limit=250&page=${page}`,
      { headers: { "User-Agent": "Mozilla/5.0" } });
    const j = await r.json();
    if (!j.products || !j.products.length) break;
    all.push(...j.products);
    if (j.products.length < 250) break;
  }
  return all;
}

const md5 = (buf) => crypto.createHash("md5").update(buf).digest("hex");

// --- Make detection & SKU helpers (import mode) ---------------------------
const MAKES = [
  ["KTM", /\bktm\b/i, "KTM"],
  ["Husqvarna", /husqvarna|husky/i, "HQV"],
  ["Honda", /honda/i, "HON"],
  ["Kawasaki", /kawasaki/i, "KAW"],
  ["Yamaha", /yamaha/i, "YAM"],
  ["Suzuki", /suzuki/i, "SUZ"],
  ["GasGas", /gas\s?gas/i, "GG"],
  ["Beta", /beta/i, "BTA"],
];
const detectMake = (title) => MAKES.find(([, re]) => re.test(title)) || null;
const KIT_DESC =
  "Full Graphics Kit includes printed graphics for Tank Shrouds, Side Number " +
  "Plates, Airbox, Rear Fender, Front Fender, Front Number Plate, Fork Guards, " +
  "and Swingarms. Printed on high-tac vinyl with premium gloss laminate for " +
  "maximum durability. Does not include seat covers or plastics.";

function makeSku(title, abbr, used) {
  // design portion = title minus make words / generic kit words
  const slug = title.toLowerCase()
    .replace(/\b(ktm|husqvarna|husky|honda|kawasaki|yamaha|suzuki|gas\s?gas|beta|for|the|graphic|kit|graphics|series|s)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).join("").slice(0, 6).toUpperCase() || "KIT";
  let base = `GRX-${abbr}-${slug}-2425`, sku = base, n = 2;
  while (used.has(sku)) sku = `${base}-${n++}`;
  used.add(sku);
  return sku;
}

async function importMain() {
  const data = JSON.parse(fs.readFileSync(PRODUCTS, "utf8"));
  const existingNorm = new Set(
    data.filter((p) => p.category === "graphic-kit").map((p) => norm(p.name).sort().join(" "))
  );
  const usedSku = new Set(data.map((p) => p.sku));
  const catalog = await fetchCatalog();
  const semi = catalog.filter((p) => p.product_type === "Semi Custom Graphics");

  const toAdd = [];
  let skipNoMake = 0, skipExisting = 0, skipNoImg = 0;
  for (const p of semi) {
    if (!p.images || !p.images.length) { skipNoImg++; continue; }
    const m = detectMake(p.title);
    if (!m) { skipNoMake++; continue; }
    if (existingNorm.has(norm(p.title).sort().join(" "))) { skipExisting++; continue; }
    toAdd.push({ src: p, make: m[0], abbr: m[2] });
  }

  console.log(`Semi Custom Graphics in catalog: ${semi.length}`);
  console.log(`  skip (no make in title): ${skipNoMake}`);
  console.log(`  skip (already in your catalog): ${skipExisting}`);
  console.log(`  skip (no image): ${skipNoImg}`);
  console.log(`  -> NEW to import: ${toAdd.length}`);
  const byMake = {};
  toAdd.forEach((x) => (byMake[x.make] = (byMake[x.make] || 0) + 1));
  console.log("  by make:", JSON.stringify(byMake));
  console.log("\n  sample of new products:");
  toAdd.slice(0, 12).forEach((x) => console.log(`    [${x.make}] ${x.src.title}`));

  if (!APPLY) {
    console.log("\n(dry-run; pass --apply to download images and write products.json)");
    return;
  }

  const now = new Date();
  let added = 0;
  for (const x of toAdd) {
    const url = x.src.images[0].src.split("?")[0];
    const ext = (url.split(".").pop().match(/^[a-z0-9]+/i) || ["jpg"])[0];
    const id = crypto.randomUUID();
    const fname = `${crypto.randomUUID()}.${ext}`;
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) { console.log("  FAILED img", x.src.title); continue; }
    fs.writeFileSync(path.join(UPLOADS, fname), Buffer.from(await resp.arrayBuffer()));
    data.push({
      id, sku: makeSku(x.src.title, x.abbr, usedSku), name: x.src.title,
      category: "graphic-kit", make: x.make, model: "",
      year_from: 2023, year_to: 2026, price: 250, description: KIT_DESC,
      images: [`uploads/products/${fname}`], in_stock: true, featured: false,
      created_at: new Date(now.getTime() + added * 1000).toISOString(),
    });
    added++;
    if (added % 50 === 0) console.log(`  ...${added} downloaded`);
  }
  fs.writeFileSync(PRODUCTS, JSON.stringify(data, null, 2));
  console.log(`\nImported ${added} new products. products.json now has ${data.length} total.`);
}

async function main() {
  const data = JSON.parse(fs.readFileSync(PRODUCTS, "utf8"));
  const kits = data.filter((p) => p.category === "graphic-kit");
  const catalog = await fetchCatalog();
  const mxg = catalog.map((p) => ({ p, n: norm(p.title) }));

  const updates = [];
  for (const k of kits) {
    if (!k.images || !k.images.length) continue;
    const kn = norm(k.name);
    let best = null, bs = 0;
    for (const m of mxg) { const s = sim(kn, m.n); if (s > bs) { bs = s; best = m.p; } }
    if (bs < 0.7 || !best || !best.images.length) continue;
    updates.push({ product: k, score: bs, match: best });
  }

  console.log(`Confident matches: ${updates.length} of ${kits.length} kits`);
  let changed = 0, same = 0;
  for (const u of updates) {
    const localRel = u.product.images[0];
    const localPath = path.join(ROOT, localRel);
    const srcUrl = u.match.images[0].src.split("?")[0];
    const resp = await fetch(srcUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const newBuf = Buffer.from(await resp.arrayBuffer());
    const oldBuf = fs.existsSync(localPath) ? fs.readFileSync(localPath) : Buffer.alloc(0);
    if (md5(newBuf) === md5(oldBuf)) { same++; continue; }
    changed++;
    console.log(`${APPLY ? "WRITE" : "DIFF"} [${u.product.make}] "${u.product.name}"`);
    console.log(`     <- ${u.match.title}  (score ${u.score.toFixed(2)})`);
    console.log(`     -> ${localRel}  (${oldBuf.length} -> ${newBuf.length} bytes)`);
    if (APPLY) fs.writeFileSync(localPath, newBuf);
  }
  console.log(`\n${changed} would change, ${same} already identical. ${APPLY ? "(applied)" : "(dry-run; pass --apply to write)"}`);
}

(IMPORT ? importMain() : main());
