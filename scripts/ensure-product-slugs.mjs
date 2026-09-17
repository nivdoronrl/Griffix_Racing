#!/usr/bin/env node
/**
 * Ensure every product in server/data/products.json has a unique kebab-case slug.
 * Derives from name; disambiguates with make/model/id. Fails hard on unresolved collisions.
 *
 * Usage: node scripts/ensure-product-slugs.mjs [--check]
 *   --check  validate only (exit 1 on missing/duplicate); do not write
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_PATH = path.join(ROOT, 'server/data/products.json');

export function slugify(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'product';
}

export function assignSlugs(products) {
  const used = new Map(); // slug -> id
  const out = [];
  const collisions = [];

  for (const raw of products) {
    const p = { ...raw };
    const candidates = [];
    if (p.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) {
      candidates.push(p.slug);
    }
    candidates.push(
      slugify(p.name),
      slugify([p.make, p.name].filter(Boolean).join(' ')),
      slugify([p.make, p.model, p.name].filter(Boolean).join(' ')),
      slugify([p.make, p.model, p.name, p.id].filter(Boolean).join(' ')),
      `${slugify(p.name)}-${slugify(p.id)}`,
    );

    let chosen = null;
    for (const c of candidates) {
      if (!c || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c)) continue;
      const owner = used.get(c);
      if (!owner || owner === p.id) {
        chosen = c;
        break;
      }
    }
    if (!chosen) {
      collisions.push({ id: p.id, name: p.name });
      continue;
    }
    used.set(chosen, p.id);
    p.slug = chosen;
    out.push(p);
  }

  if (collisions.length) {
    const msg = collisions
      .slice(0, 20)
      .map((c) => `${c.id}: ${c.name}`)
      .join('\n');
    throw new Error(
      `Slug collision unresolved for ${collisions.length} product(s):\n${msg}`,
    );
  }

  const seen = new Set();
  for (const p of out) {
    if (seen.has(p.slug)) {
      throw new Error(`Duplicate slug after assign: ${p.slug}`);
    }
    seen.add(p.slug);
  }

  return out;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
  if (!Array.isArray(products)) {
    throw new Error('products.json must be a JSON array');
  }

  const next = assignSlugs(products);

  if (checkOnly) {
    const missing = products.filter((p) => !p.slug);
    if (missing.length) {
      console.error(`--check failed: ${missing.length} products missing slug`);
      process.exit(1);
    }
    const slugs = products.map((p) => p.slug);
    if (new Set(slugs).size !== slugs.length) {
      console.error('--check failed: duplicate slugs');
      process.exit(1);
    }
    console.log(`OK: ${products.length} unique slugs`);
    return;
  }

  fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`Wrote ${next.length} products with unique slugs → ${PRODUCTS_PATH}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
