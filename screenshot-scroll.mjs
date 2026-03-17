import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'temporary screenshots');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function nextFilename(label) {
  const files = fs.existsSync(outDir) ? fs.readdirSync(outDir) : [];
  const nums = files
    .map(f => f.match(/^screenshot-(\d+)/))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10));
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
}

const url = process.argv[2] || 'http://localhost:3000';
const scrollY = parseInt(process.argv[3] || '0', 10);
const label = process.argv[4] || '';
const filename = nextFilename(label);
const outPath = path.join(outDir, filename);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));
await page.evaluate(y => window.scrollTo(0, y), scrollY);
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: outPath, fullPage: false });

await browser.close();
console.log(`Screenshot saved: temporary screenshots/${filename}`);
