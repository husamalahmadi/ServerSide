/**
 * Writes standalone crawlable HTML for /en/tutorials and /ar/tutorials (+ each article).
 * Output: public/{locale}/tutorials/index.html and public/{locale}/tutorials/{slug}.html
 * Run: node scripts/generate-tutorial-static-pages.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TUTORIAL_ARTICLES } from "../src/data/tutorials/articles.js";
import { resolveTutorialArticle, resolveTutorialArticles } from "../src/data/tutorials/resolve.js";
import {
  buildTutorialArticleSeo,
  buildTutorialsIndexSeo,
} from "../shared/seo/structuredData.js";
import {
  localizeTutorialBodyHtml,
  tutorialArticlePath,
  tutorialIndexPath,
} from "../shared/seo/tutorialPaths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");

const SITE = (
  process.env.VITE_SITE_URL ||
  process.env.SITEMAP_SITE_URL ||
  "https://trueprice.cash"
)
  .trim()
  .replace(/\/+$/, "");

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text) {
  return escapeHtml(text);
}

function stripTitle(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hreflangLinks(alternates) {
  if (!alternates) return "";
  return Object.entries(alternates)
    .map(
      ([lang, path]) =>
        `<link rel="alternate" hreflang="${escapeAttr(lang)}" href="${escapeAttr(SITE + path)}" />`
    )
    .join("\n  ");
}

function pageShell({ locale, seo, bodyHtml, dir }) {
  const canonical = `${SITE}${seo.pathname}`;
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(seo.documentTitle)}</title>
  <meta name="description" content="${escapeAttr(seo.metaDescription)}" />
  <link rel="canonical" href="${escapeAttr(canonical)}" />
  ${hreflangLinks(seo.alternates)}
  <meta property="og:title" content="${escapeAttr(seo.documentTitle)}" />
  <meta property="og:description" content="${escapeAttr(seo.metaDescription)}" />
  <meta property="og:url" content="${escapeAttr(canonical)}" />
  <meta property="og:type" content="article" />
  <script type="application/ld+json">${JSON.stringify(seo.jsonLd).replace(/</g, "\\u003c")}</script>
  <style>
    :root { --tp-primary: #2c7be5; --tp-ink: #1a2b42; --tp-muted: #5a6b85; --tp-border: #d4e6fb; }
    body { font-family: system-ui,Segoe UI,Roboto,sans-serif; margin: 0; color: var(--tp-ink); line-height: 1.65; background: #f6faff; }
    .wrap { max-width: 820px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
    header.site { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--tp-border); }
    header.site a { color: var(--tp-primary); text-decoration: none; font-weight: 600; font-size: 14px; }
    .brand { font-weight: 800; font-size: 1.1rem; color: var(--tp-ink); }
    .hero { background: linear-gradient(140deg,#fff,#eef5ff); border: 1px solid var(--tp-border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.25rem; }
    .hero h1 { margin: 0 0 0.5rem; font-size: 1.75rem; line-height: 1.25; }
    .hero h1 em { font-style: normal; color: var(--tp-primary); }
    .hero p { margin: 0; color: var(--tp-muted); font-size: 15px; }
    .meta { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; font-size: 13px; color: var(--tp-muted); }
    article { background: #fff; border: 1px solid var(--tp-border); border-radius: 12px; padding: 1.25rem 1.35rem; }
    article a { color: var(--tp-primary); }
    article h2 { margin: 1.5rem 0 0.75rem; font-size: 1.25rem; }
    article h3 { margin: 1rem 0 0.5rem; font-size: 1.05rem; }
    article p { margin: 0 0 0.85rem; font-size: 15px; }
    article table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 1rem 0; }
    article th, article td { border: 1px solid var(--tp-border); padding: 0.5rem 0.65rem; text-align: start; }
    article th { background: #f0f6ff; }
    .catalog { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.65rem; }
    .catalog a { display: block; padding: 0.85rem 1rem; background: #fff; border: 1px solid var(--tp-border); border-radius: 10px; color: var(--tp-ink); text-decoration: none; font-weight: 600; }
    .catalog a:hover { border-color: var(--tp-primary); }
    .series-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1.25rem; }
    .series-nav a { display: block; padding: 0.75rem 1rem; background: #fff; border: 1px solid var(--tp-border); border-radius: 10px; text-decoration: none; color: var(--tp-primary); font-weight: 600; font-size: 14px; }
    footer { margin-top: 2rem; text-align: center; font-size: 12px; color: var(--tp-muted); }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="site">
      <a class="brand" href="/">TruePrice.Cash</a>
      <div>
        <a href="${tutorialIndexPath("en")}">English</a>
        ·
        <a href="${tutorialIndexPath("ar")}">العربية</a>
        ·
        <a href="/">${locale === "ar" ? "الرئيسية" : "Dashboard"}</a>
      </div>
    </header>
    ${bodyHtml}
    <footer>© TruePrice.Cash</footer>
  </div>
</body>
</html>`;
}

function writeArticlePage(locale, article) {
  const seo = buildTutorialArticleSeo({ article, lang: locale });
  const dir = locale === "ar" ? "rtl" : "ltr";
  const titleHtml = article.titleHtml || stripTitle(article.titleHtml);
  const body = localizeTutorialBodyHtml(article.bodyHtml, locale);
  const prev = article.prev
    ? `<a href="${tutorialArticlePath(locale, article.prev.slug)}">← ${escapeHtml(article.prev.title)}</a>`
    : "<span></span>";
  const next = article.next
    ? `<a href="${tutorialArticlePath(locale, article.next.slug)}">${escapeHtml(article.next.title)} →</a>`
    : "";

  const inner = `<div class="hero">
      <p style="font-size:11px;font-weight:700;color:var(--tp-primary);text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(article.seriesLabel || "")}</p>
      <h1>${titleHtml}</h1>
      <p>${escapeHtml(article.subtitle || "")}</p>
      <div class="meta">
        ${article.readingTime ? `<span>${escapeHtml(article.readingTime)}</span>` : ""}
        ${article.level ? `<span>${escapeHtml(article.level)}</span>` : ""}
      </div>
    </div>
    <article>${body}</article>
    <nav class="series-nav" aria-label="Series">${prev}${next}</nav>`;

  const outDir = join(PUBLIC, locale, "tutorials");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${article.slug}.html`);
  writeFileSync(outFile, pageShell({ locale, seo, bodyHtml: inner, dir }), "utf8");
  return outFile;
}

function writeIndexPage(locale, articles) {
  const seo = buildTutorialsIndexSeo({ articles, lang: locale });
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isAr = locale === "ar";
  const list = articles
    .map((a) => {
      const num = String(a.order).padStart(2, "0");
      return `<li><a href="${tutorialArticlePath(locale, a.slug)}"><span>${num}</span> ${escapeHtml(stripTitle(a.titleHtml))}</a></li>`;
    })
    .join("\n      ");

  const inner = `<div class="hero">
      <h1>${isAr ? "تعلّم الاستثمار عبر <em>التحليل الأساسي</em>" : "Learn to invest with <em>fundamentals</em>"}</h1>
      <p>${escapeHtml(seo.metaDescription)}</p>
    </div>
    <ol class="catalog">${list}</ol>`;

  const outDir = join(PUBLIC, locale, "tutorials");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "index.html");
  writeFileSync(outFile, pageShell({ locale, seo, bodyHtml: inner, dir }), "utf8");
  return outFile;
}

function main() {
  let count = 0;
  for (const locale of ["en", "ar"]) {
    const articles = resolveTutorialArticles(TUTORIAL_ARTICLES, locale);
    writeIndexPage(locale, articles);
    count += 1;
    for (const base of TUTORIAL_ARTICLES) {
      const article = resolveTutorialArticle(base, locale, TUTORIAL_ARTICLES);
      if (article) {
        writeArticlePage(locale, article);
        count += 1;
      }
    }
  }
  console.log(`[tutorial-static] Wrote ${count} standalone HTML pages under public/{en,ar}/tutorials/`);
}

main();
