/**
 * Writes public/sitemap.xml from static routes plus every ticker in
 * public/data/sp500_grouped_by_industry.json and tasi_grouped_by_industry.json
 * (same sources as src/data/stocksCatalog.js).
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

function main() {
  const usRaw = JSON.parse(readFileSync(join(PUBLIC, "data/sp500_grouped_by_industry.json"), "utf8"));
  const saRaw = JSON.parse(readFileSync(join(PUBLIC, "data/tasi_grouped_by_industry.json"), "utf8"));

  const usTickers = collectTickers(usRaw, { tickerUppercase: true });
  const saTickers = collectTickers(saRaw, { tickerUppercase: false });

  const staticPages = [
    { loc: `${SITE}/`, changefreq: "weekly", priority: "1.0" },
    { loc: `${SITE}/blogs`, changefreq: "weekly", priority: "0.9" },
    { loc: `${SITE}/about`, changefreq: "monthly", priority: "0.7" },
    { loc: `${SITE}/contact`, changefreq: "monthly", priority: "0.7" },
  ];

  const stockLocs = [];
  for (const t of usTickers) {
    stockLocs.push(`${SITE}/stock/${encodeURIComponent(t)}`);
  }
  for (const t of saTickers) {
    stockLocs.push(`${SITE}/stock/${encodeURIComponent(t)}`);
  }
  stockLocs.sort((a, b) => a.localeCompare(b, "en"));

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const { loc, changefreq, priority } of staticPages) {
    lines.push(urlEntry(loc, changefreq, priority));
  }
  for (const loc of stockLocs) {
    lines.push(urlEntry(loc, "weekly", "0.6"));
  }

  lines.push("</urlset>", "");

  writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`[sitemap] Wrote ${OUT} (${staticPages.length + stockLocs.length} URLs)`);
}

main();
