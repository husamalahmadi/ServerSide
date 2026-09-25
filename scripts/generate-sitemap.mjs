/**
 * Writes a sitemap index at public/sitemap.xml plus child sitemaps:
 * sitemap-core.xml, sitemap-stocks-sa.xml, sitemap-stocks-us.xml,
 * sitemap-stocks-jp.xml, sitemap-stocks-uk.xml, sitemap-tutorials.xml,
 * sitemap-tasi.xml, sitemap-blogs.xml (when public/data/blog-posts.json has posts).
 *
 * Stock universes match src/data/stocksCatalog.js. lastmod is the UTC date of
 * the last git commit for that URL's source (route, tutorial HTML, or catalog),
 * falling back to the file mtime when git history is unavailable.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TUTORIAL_ARTICLES } from "../src/data/tutorials/articles.js";
import {
  EARNINGS_CALENDAR_PATH,
  UNDERVALUED_PATH,
  catalogFromGrouped,
  comparePairs,
  earningsNotePath,
  sectorPath,
} from "../shared/tasiProgrammatic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const SOURCE_EN = join(ROOT, "content", "tutorials", "source");
const SOURCE_AR = join(ROOT, "content", "tutorials", "source-ar");

const SITE = (
  process.env.VITE_SITE_URL ||
  process.env.SITEMAP_SITE_URL ||
  "https://trueprice.cash"
)
  .trim()
  .replace(/\/+$/, "");

const URLSET_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

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

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function utcDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function lastmodFromGit(path) {
  try {
    const iso = execFileSync("git", ["log", "-1", "--format=%cI", "--", path], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return iso ? utcDate(iso) : null;
  } catch {
    return null;
  }
}

function lastmodFromPath(path) {
  if (!path || !existsSync(path)) return null;
  const fromGit = lastmodFromGit(path);
  if (fromGit) return fromGit;
  try {
    return utcDate(statSync(path).mtime);
  } catch {
    return null;
  }
}

function newestLastmod(paths) {
  let best = null;
  for (const path of paths) {
    const date = lastmodFromPath(path);
    if (date && (!best || date > best)) best = date;
  }
  return best || todayUtc();
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
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

function indexTutorialSources(dir) {
  const bySlug = new Map();
  if (!existsSync(dir)) return bySlug;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".html")) continue;
    const stem = name.slice(0, -".html".length);
    const slug = stem.replace(/^\d+-/, "");
    bySlug.set(slug, join(dir, name));
  }
  return bySlug;
}

function writeUrlset(filename, entries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="${URLSET_NS}">`,
  ];
  let maxLastmod = null;
  for (const entry of entries) {
    lines.push(urlEntry(entry));
    if (!maxLastmod || entry.lastmod > maxLastmod) maxLastmod = entry.lastmod;
  }
  lines.push("</urlset>", "");
  writeFileSync(join(PUBLIC, filename), lines.join("\n"), "utf8");
  return { filename, count: entries.length, lastmod: maxLastmod || todayUtc() };
}

function writeIndex(children) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<sitemapindex xmlns="${URLSET_NS}">`,
  ];
  for (const child of children) {
    lines.push(`  <sitemap>
    <loc>${escapeXml(`${SITE}/${child.filename}`)}</loc>
    <lastmod>${child.lastmod}</lastmod>
  </sitemap>`);
  }
  lines.push("</sitemapindex>", "");
  writeFileSync(join(PUBLIC, "sitemap.xml"), lines.join("\n"), "utf8");
}

function stockEntries(tickers, lastmod) {
  return uniqueStable(tickers)
    .sort((a, b) => a.localeCompare(b, "en"))
    .flatMap((ticker) =>
      ["en", "ar"].map((locale) => ({
        loc: `${SITE}/${locale}/stock/${encodeURIComponent(ticker)}`,
        lastmod,
        changefreq: "weekly",
        priority: "0.6",
      }))
    );
}

function main() {
  const catalogs = {
    us: join(PUBLIC, "data/sp500_grouped_by_industry.json"),
    sa: join(PUBLIC, "data/tasi_grouped_by_industry.json"),
    jp: join(PUBLIC, "data/tokyo_stock_exchange.json"),
    uk: join(PUBLIC, "data/london_stock_exchange.json"),
  };

  const usTickers = collectTickers(readJsonSafe(catalogs.us), { tickerUppercase: true });
  const saTickers = collectTickers(readJsonSafe(catalogs.sa), { tickerUppercase: false });
  const jpTickers = collectTickers(readJsonSafe(catalogs.jp), { tickerUppercase: true });
  const ukTickers = collectTickers(readJsonSafe(catalogs.uk), { tickerUppercase: true });

  const seen = new Set();
  function claim(tickers) {
    const out = [];
    for (const ticker of tickers) {
      if (seen.has(ticker)) continue;
      seen.add(ticker);
      out.push(ticker);
    }
    return out;
  }

  // First market in this list keeps a colliding /stock/:ticker URL.
  const claimed = {
    us: claim(usTickers),
    sa: claim(saTickers),
    jp: claim(jpTickers),
    uk: claim(ukTickers),
  };

  const corePages = [
    { path: "/", changefreq: "weekly", priority: "1.0", sources: ["src/routes/Home.jsx"] },
    { path: "/us-markets", changefreq: "daily", priority: "0.8", sources: ["src/routes/UsMarketPerformance.jsx"] },
    { path: "/sa-markets", changefreq: "daily", priority: "0.8", sources: ["src/routes/SaMarketPerformance.jsx"] },
    { path: "/en/blogs", changefreq: "weekly", priority: "0.9", sources: ["src/routes/Blogs.jsx"] },
    { path: "/ar/blogs", changefreq: "weekly", priority: "0.9", sources: ["src/routes/Blogs.jsx"] },
    { path: "/methodology", changefreq: "monthly", priority: "0.8", sources: ["src/routes/Methodology.jsx"] },
    { path: "/about", changefreq: "monthly", priority: "0.7", sources: ["src/routes/AboutUs.jsx"] },
    { path: "/contact", changefreq: "monthly", priority: "0.7", sources: ["src/routes/Contact.jsx"] },
  ].map((page) => ({
    loc: `${SITE}${page.path}`,
    lastmod: newestLastmod(page.sources.map((rel) => join(ROOT, rel))),
    changefreq: page.changefreq,
    priority: page.priority,
  }));

  const enSources = indexTutorialSources(SOURCE_EN);
  const arSources = indexTutorialSources(SOURCE_AR);
  const articlesMtime = join(ROOT, "src/data/tutorials/articles.js");
  const tutorialHubs = ["en", "ar"].map((locale) => ({
    loc: `${SITE}/${locale}/tutorials`,
    lastmod: newestLastmod([
      join(ROOT, "src/routes/Tutorials.jsx"),
      join(PUBLIC, locale, "tutorials", "index.html"),
    ]),
    changefreq: "monthly",
    priority: "0.9",
  }));

  const tutorialArticles = TUTORIAL_ARTICLES.flatMap((article) =>
    ["en", "ar"].map((locale) => {
      const source = locale === "ar" ? arSources.get(article.slug) : enSources.get(article.slug);
      return {
        loc: `${SITE}/${locale}/tutorials/${article.slug}`,
        lastmod: newestLastmod([source, articlesMtime].filter(Boolean)),
        changefreq: "monthly",
        priority: "0.85",
      };
    })
  );

  const blogDataFile = join(PUBLIC, "data", "blog-posts.json");
  const blogEntries = [];
  if (existsSync(blogDataFile)) {
    const data = readJsonSafe(blogDataFile);
    const postDate = (post) => {
      const dated = String(post?.updated || post?.published || "").slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(dated) ? dated : null;
    };
    let newestPostDate = null;
    for (const post of data.posts || []) {
      const dated = postDate(post);
      if (dated && (!newestPostDate || dated > newestPostDate)) newestPostDate = dated;
    }
    for (const post of data.posts || []) {
      const path = String(post?.path || "");
      if (!/^\/(en|ar)\/blog\/[^/]+$/.test(path)) continue;
      blogEntries.push({
        loc: `${SITE}${path}`,
        lastmod: postDate(post) || newestPostDate || todayUtc(),
        changefreq: "monthly",
        priority: "0.75",
      });
    }
  }
  const saGrouped = readJsonSafe(catalogs.sa);
  const tasiCompanies = catalogFromGrouped(saGrouped);
  const tasiCatalogLastmod = newestLastmod([catalogs.sa]);
  const tasiToday = todayUtc();
  const seenSectors = new Set();
  const tasiEntries = [
    {
      loc: `${SITE}${encodeURI(UNDERVALUED_PATH)}`,
      lastmod: tasiToday,
      changefreq: "daily",
      priority: "0.8",
    },
    {
      loc: `${SITE}${encodeURI(EARNINGS_CALENDAR_PATH)}`,
      lastmod: tasiToday,
      changefreq: "daily",
      priority: "0.8",
    },
  ];
  for (const company of tasiCompanies) {
    if (seenSectors.has(company.sectorSlug)) continue;
    seenSectors.add(company.sectorSlug);
    tasiEntries.push({
      loc: `${SITE}${encodeURI(sectorPath(company.sectorSlug))}`,
      lastmod: tasiCatalogLastmod,
      changefreq: "daily",
      priority: "0.7",
    });
  }
  for (const pair of comparePairs(tasiCompanies)) {
    tasiEntries.push({
      loc: `${SITE}/ar/compare/${pair.slug}`,
      lastmod: tasiCatalogLastmod,
      changefreq: "weekly",
      priority: "0.5",
    });
  }
  const earningsFile = join(ROOT, "server", "data", "earnings-commentary.json");
  if (existsSync(earningsFile)) {
    const saved = readJsonSafe(earningsFile);
    for (const note of Object.values(saved.notes || {})) {
      if (!note?.ticker || !note?.period) continue;
      tasiEntries.push({
        loc: `${SITE}${earningsNotePath(note.ticker, note.period)}`,
        lastmod: String(note.publishedAt || tasiToday).slice(0, 10),
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  }

  const blogsSitemap = join(PUBLIC, "sitemap-blogs.xml");
  if (!blogEntries.length && existsSync(blogsSitemap)) unlinkSync(blogsSitemap);

  const children = [
    writeUrlset("sitemap-core.xml", corePages),
    writeUrlset("sitemap-stocks-sa.xml", stockEntries(claimed.sa, newestLastmod([catalogs.sa]))),
    writeUrlset("sitemap-stocks-us.xml", stockEntries(claimed.us, newestLastmod([catalogs.us]))),
    writeUrlset("sitemap-tutorials.xml", [...tutorialHubs, ...tutorialArticles]),
    ...(blogEntries.length ? [writeUrlset("sitemap-blogs.xml", blogEntries)] : []),
    writeUrlset("sitemap-stocks-jp.xml", stockEntries(claimed.jp, newestLastmod([catalogs.jp]))),
    writeUrlset("sitemap-stocks-uk.xml", stockEntries(claimed.uk, newestLastmod([catalogs.uk]))),
    writeUrlset("sitemap-tasi.xml", tasiEntries),
  ].filter((child) => child.count > 0);

  writeIndex(children);

  const total = children.reduce((sum, child) => sum + child.count, 0);
  console.log(`[sitemap] Wrote public/sitemap.xml index (${children.length} sitemaps, ${total} URLs)`);
  for (const child of children) {
    console.log(`[sitemap]   ${child.filename}: ${child.count} URLs, lastmod ${child.lastmod}`);
  }
}

main();
