/**
 * Import tutorial HTML from content/tutorials/source/*.html into src/data/tutorials/articles.js
 * Run: node scripts/sync-tutorials.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE_DIR = join(ROOT, "content", "tutorials", "source");
const OUT_FILE = join(ROOT, "src", "data", "tutorials", "articles.js");

const SLUG_BY_FILE = {
  "01-what-is-fundamental-analysis": "what-is-fundamental-analysis",
  "02-income-statement": "income-statement",
  "03-balance-sheet": "balance-sheet",
  "04-cash-flow-statement": "cash-flow-statement",
  "05-financial-ratios": "financial-ratios",
  "06-dcf-valuation": "dcf-valuation",
  "07-competitive-moat": "competitive-moat",
  "08-stock-picking-process": "stock-picking-process",
  "09-earnings-reports": "earnings-reports",
  "10-financial-red-flags": "financial-red-flags",
};

function extract(tag, html, attr) {
  const re = attr
    ? new RegExp(`<${tag}[^>]*${attr}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")
    : new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function extractMeta(html, name) {
  const re = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, "i");
  return html.match(re)?.[1]?.trim() || "";
}

function extractTitle(html) {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || "";
}

function stripOuterNav(html) {
  return html.replace(/<nav[^>]*>[\s\S]*?<\/nav>\s*<div class="progress-bar">/i, '<div class="progress-bar">');
}

function rewriteTutorialLinks(html) {
  let out = html;
  for (const [fileStem, slug] of Object.entries(SLUG_BY_FILE)) {
    const re = new RegExp(`${fileStem}\\.html`, "gi");
    out = out.replace(re, `/tutorials/${slug}`);
  }
  out = out.replace(/href="\/tutorials\/([^"]+)"/g, (_, slug) => `href="/tutorials/${slug}"`);
  return out;
}

function parseArticleNav(contentHtml) {
  const navBlock = contentHtml.match(/<nav class="article-nav"[\s\S]*?<\/nav>/i)?.[0] || "";
  let prev = null;
  let next = null;
  const pills = [...navBlock.matchAll(/<a class="nav-pill" href="([^"]*)"[\s\S]*?<span class="nav-pill-title">([^<]*)<\/span>/gi)];
  for (const [, href, title] of pills) {
    const slug = href.replace(/^\/?tutorials\//, "").replace(/\.html$/, "").replace(/^\d+-/, "");
    const mapped = Object.values(SLUG_BY_FILE).includes(slug)
      ? slug
      : SLUG_BY_FILE[href.replace(/\.html$/, "").split("/").pop()] || null;
    if (!mapped) continue;
    const entry = { slug: mapped, title: title.trim() };
    if (/previous|←/i.test(navBlock.slice(0, navBlock.indexOf(href)))) {
      prev = entry;
    } else {
      next = entry;
    }
  }
  if (pills.length === 1) {
    const [, href, title] = pills[0];
    const stem = href.replace(/\.html$/, "").replace(/^.*\//, "");
    const slug = SLUG_BY_FILE[stem];
    if (slug) next = { slug, title: title.trim() };
  }
  if (pills.length === 2) {
    const [a, b] = pills;
    const slugA = SLUG_BY_FILE[a[1].replace(/\.html$/, "").replace(/^.*\//, "")];
    const slugB = SLUG_BY_FILE[b[1].replace(/\.html$/, "").replace(/^.*\//, "")];
    if (slugA) prev = { slug: slugA, title: a[2].trim() };
    if (slugB) next = { slug: slugB, title: b[2].trim() };
  }
  return { prev, next };
}

function parseMetaItem(html, label) {
  const re = new RegExp(
    `<span class="meta-label">${label}<\\/span>\\s*<span class="meta-value">([^<]*)<\\/span>`,
    "i"
  );
  return html.match(re)?.[1]?.trim() || "";
}

function parseFile(filename) {
  const stem = filename.replace(/\.html$/i, "");
  const slug = SLUG_BY_FILE[stem];
  if (!slug) throw new Error(`Unknown tutorial file: ${filename}`);

  const raw = readFileSync(join(SOURCE_DIR, filename), "utf8");
  const body = stripOuterNav(raw);
  const heroBlock = extract("header", body, 'class="hero"') || extract("div", body, 'class="hero"');
  const contentMatch = body.match(/<main class="content-wrap">([\s\S]*?)<\/main>/i);
  let contentHtml = contentMatch?.[1]?.trim() || "";

  const { prev, next } = parseArticleNav(contentHtml);
  contentHtml = contentHtml.replace(/<nav class="article-nav"[\s\S]*?<\/nav>/i, "").trim();
  contentHtml = rewriteTutorialLinks(contentHtml);

  const h1Inner = extract("h1", heroBlock).replace(/\s+/g, " ").trim();
  const order = Number(stem.split("-")[0]) || 0;

  return {
    slug,
    order,
    documentTitle: extractTitle(raw),
    metaDescription: extractMeta(raw, "description"),
    seriesLabel: extract("span", heroBlock, 'class="series-label"').replace(/<[^>]+>/g, ""),
    titleHtml: h1Inner,
    subtitle: extract("p", heroBlock, 'class="hero-sub"').replace(/<[^>]+>/g, "") || extract("p", heroBlock, 'class="hero-sub"'),
    readingTime: parseMetaItem(heroBlock, "Reading time"),
    level: parseMetaItem(heroBlock, "Level"),
    series: parseMetaItem(heroBlock, "Series"),
    bodyHtml: contentHtml,
    prev,
    next,
  };
}

function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`Missing ${SOURCE_DIR}. Add tutorial HTML files first.`);
    process.exit(1);
  }
  const files = readdirSync(SOURCE_DIR)
    .filter((f) => /^\d{2}-.+\.html$/i.test(f))
    .sort();
  if (!files.length) {
    console.error("No tutorial HTML files found.");
    process.exit(1);
  }

  const articles = files.map(parseFile).sort((a, b) => a.order - b.order);

  for (let i = 0; i < articles.length; i++) {
    if (!articles[i].prev && i > 0) {
      articles[i].prev = { slug: articles[i - 1].slug, title: stripTags(articles[i - 1].titleHtml) };
    }
    if (!articles[i].next && i < articles.length - 1) {
      articles[i].next = { slug: articles[i + 1].slug, title: stripTags(articles[i + 1].titleHtml) };
    }
  }

  const out = `/** Generated by scripts/sync-tutorials.mjs — do not edit by hand. */\nexport const TUTORIAL_ARTICLES = ${JSON.stringify(articles, null, 2)};\n\nexport const TUTORIAL_BY_SLUG = Object.fromEntries(TUTORIAL_ARTICLES.map((a) => [a.slug, a]));\n`;
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, out, "utf8");
  console.log(`[sync-tutorials] Wrote ${articles.length} articles → ${OUT_FILE}`);
}

function stripTags(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

main();
