// Scrape MX Graphics (supplier) and refresh product images where a confident
// make+design match exists. Overwrites the existing image file in-place so
// products.json paths stay intact. Dry-run by default; pass --apply to write.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const APPLY = process.argv.includes("--apply");
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
main();
