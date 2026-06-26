/**
 * Import tutorial HTML from content/tutorials/source (en) and source-ar (ar)
 * into src/data/tutorials/articles.js
 * Run: node scripts/sync-tutorials.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE_EN = join(ROOT, "content", "tutorials", "source");
const SOURCE_AR = join(ROOT, "content", "tutorials", "source-ar");
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

const META_LABELS = {
  en: { readingTime: "Reading time", level: "Level", series: "Series" },
  ar: { readingTime: "وقت القراءة", level: "المستوى", series: "السلسلة" },
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
  return out;
}

function parseMetaItem(html, labels) {
  for (const label of Object.values(labels)) {
    const re = new RegExp(
      `<span class="meta-label">${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/span>\\s*<span class="meta-value">([^<]*)<\\/span>`,
      "i"
    );
    const val = html.match(re)?.[1]?.trim();
    if (val) return val;
  }
  return "";
}

function parseFile(filename, sourceDir, lang) {
  const stem = filename.replace(/\.html$/i, "");
  const slug = SLUG_BY_FILE[stem];
  if (!slug) throw new Error(`Unknown tutorial file: ${filename}`);

  const raw = readFileSync(join(sourceDir, filename), "utf8");
  const body = stripOuterNav(raw);
  const heroBlock = extract("header", body, 'class="hero"') || extract("div", body, 'class="hero"');
  const contentMatch = body.match(/<main class="content-wrap">([\s\S]*?)<\/main>/i);
  let contentHtml = contentMatch?.[1]?.trim() || "";

  contentHtml = contentHtml.replace(/<nav class="article-nav"[\s\S]*?<\/nav>/i, "").trim();
  contentHtml = rewriteTutorialLinks(contentHtml);

  const h1Inner = extract("h1", heroBlock).replace(/\s+/g, " ").trim();
  const order = Number(stem.split("-")[0]) || 0;
  const labels = META_LABELS[lang] || META_LABELS.en;

  return {
    documentTitle: extractTitle(raw),
    metaDescription: extractMeta(raw, "description"),
    seriesLabel: extract("span", heroBlock, 'class="series-label"').replace(/<[^>]+>/g, ""),
    titleHtml: h1Inner,
    subtitle:
      extract("p", heroBlock, 'class="hero-sub"').replace(/<[^>]+>/g, "") ||
      extract("p", heroBlock, 'class="hero-sub"'),
    readingTime: parseMetaItem(heroBlock, { readingTime: labels.readingTime }),
    level: parseMetaItem(heroBlock, { level: labels.level }),
    series: parseMetaItem(heroBlock, { series: labels.series }),
    bodyHtml: contentHtml,
    order,
    slug,
  };
}

function stripTags(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  if (!existsSync(SOURCE_EN)) {
    console.error(`Missing ${SOURCE_EN}. Add tutorial HTML files first.`);
    process.exit(1);
  }
  const files = readdirSync(SOURCE_EN)
    .filter((f) => /^\d{2}-.+\.html$/i.test(f))
    .sort();
  if (!files.length) {
    console.error("No tutorial HTML files found.");
    process.exit(1);
  }

  const hasAr = existsSync(SOURCE_AR);
  if (!hasAr) {
    console.warn(`[sync-tutorials] No ${SOURCE_AR} — Arabic will fall back to English.`);
  }

  const articles = files.map((filename) => {
    const en = parseFile(filename, SOURCE_EN, "en");
    const { slug, order, ...enLocale } = en;
    let arLocale = null;
    if (hasAr && existsSync(join(SOURCE_AR, filename))) {
      const ar = parseFile(filename, SOURCE_AR, "ar");
      const { slug: _s, order: _o, ...rest } = ar;
      arLocale = rest;
    }
    return { slug, order, locales: { en: enLocale, ...(arLocale ? { ar: arLocale } : {}) } };
  });

  articles.sort((a, b) => a.order - b.order);

  for (let i = 0; i < articles.length; i++) {
    for (const lang of ["en", "ar"]) {
      if (!articles[i].locales[lang]) continue;
      const titleOf = (a) => stripTags(a.locales[lang]?.titleHtml || "");
      if (i > 0 && articles[i - 1].locales[lang]) {
        articles[i].locales[lang].prev = {
          slug: articles[i - 1].slug,
          title: titleOf(articles[i - 1]),
        };
      }
      if (i < articles.length - 1 && articles[i + 1].locales[lang]) {
        articles[i].locales[lang].next = {
          slug: articles[i + 1].slug,
          title: titleOf(articles[i + 1]),
        };
      }
    }
  }

  const out = `/** Generated by scripts/sync-tutorials.mjs — do not edit by hand. */
export const TUTORIAL_ARTICLES = ${JSON.stringify(articles, null, 2)};

export const TUTORIAL_BY_SLUG = Object.fromEntries(TUTORIAL_ARTICLES.map((a) => [a.slug, a]));
`;
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, out, "utf8");
  const arCount = articles.filter((a) => a.locales.ar).length;
  console.log(`[sync-tutorials] Wrote ${articles.length} articles (${arCount} with Arabic) → ${OUT_FILE}`);
}

main();
