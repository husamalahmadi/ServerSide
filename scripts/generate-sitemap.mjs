/**
 * Writes public/sitemap.xml from static routes plus every ticker in
 * public/data/sp500_grouped_by_industry.json, tasi_grouped_by_industry.json,
 * tokyo_stock_exchange.json, and london_stock_exchange.json (same sources as src/data/stocksCatalog.js).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const OUT = join(PUBLIC, "sitemap.xml");

const SITE = (
  process.env.VITE_SITE_URL ||
  process.env.SITEMAP_SITE_URL ||
  "https://trueprice.cash"
)
  .trim()
  .replace(/\/+$/, "");

function collectTickers(grouped, { tickerUppercase }) {
  const out = [];
  for (const items of Object.values(grouped || {})) {
    for (const it of items || []) {
      const raw = String(it?.Ticker ?? it?.ticker ?? "").trim();
      if (!raw) continue;
      const ticker = tickerUppercase ? raw.toUpperCase() : raw;
      if (ticker) out.push(ticker);
    }
  }
  return out;
}

function uniqueStable(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function urlEntry(loc, changefreq, priority) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function main() {
  const usRaw = readJsonSafe(join(PUBLIC, "data/sp500_grouped_by_industry.json"));
  const saRaw = readJsonSafe(join(PUBLIC, "data/tasi_grouped_by_industry.json"));
  const jpRaw = readJsonSafe(join(PUBLIC, "data/tokyo_stock_exchange.json"));
  const ukRaw = readJsonSafe(join(PUBLIC, "data/london_stock_exchange.json"));

  const usTickers = collectTickers(usRaw, { tickerUppercase: true });
  const saTickers = collectTickers(saRaw, { tickerUppercase: false });
  const jpTickers = collectTickers(jpRaw, { tickerUppercase: true });
  const ukTickers = collectTickers(ukRaw, { tickerUppercase: true });

  const staticPages = [
    { loc: `${SITE}/`, changefreq: "weekly", priority: "1.0" },
    { loc: `${SITE}/us-markets`, changefreq: "daily", priority: "0.8" },
    { loc: `${SITE}/sa-markets`, changefreq: "daily", priority: "0.8" },
    { loc: `${SITE}/blogs`, changefreq: "weekly", priority: "0.9" },
    { loc: `${SITE}/about`, changefreq: "monthly", priority: "0.7" },
    { loc: `${SITE}/contact`, changefreq: "monthly", priority: "0.7" },
  ];

  const stockLocs = [];
  for (const t of [...usTickers, ...saTickers, ...jpTickers, ...ukTickers]) {
    stockLocs.push(`${SITE}/stock/${encodeURIComponent(t)}`);
  }
  const uniqueStockLocs = uniqueStable(stockLocs).sort((a, b) => a.localeCompare(b, "en"));

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const { loc, changefreq, priority } of staticPages) {
    lines.push(urlEntry(loc, changefreq, priority));
  }
  for (const loc of uniqueStockLocs) {
    lines.push(urlEntry(loc, "weekly", "0.6"));
  }

  lines.push("</urlset>", "");

  writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`[sitemap] Wrote ${OUT} (${staticPages.length + uniqueStockLocs.length} URLs)`);
}

main();
