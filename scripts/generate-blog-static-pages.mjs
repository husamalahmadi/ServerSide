/**
 * Writes crawlable blog HTML from the hardcoded posts in src/data/blogs/posts.js:
 *   public/{locale}/blogs/index.html
 *   public/{locale}/blog/{slug}.html
 * Also writes public/data/blog-posts.json for sitemap consumers.
 *
 * Run: node scripts/generate-blog-static-pages.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blogIndexPath, blogPostPath } from "../shared/seo/blogPaths.js";
import { tutorialArticlePath, tutorialIndexPath } from "../shared/seo/tutorialPaths.js";
import { buildBlogPostSeo, buildBlogsSeo } from "../shared/seo/structuredData.js";
import { absoluteCanonicalUrl } from "../shared/seo/canonicalUrl.js";
import { configureSeoSiteUrl } from "../shared/seo/siteUrl.js";
import { flattenBlogPosts } from "../src/data/blogs/posts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const DATA_FILE = join(PUBLIC, "data", "blog-posts.json");

const SITE = (
  process.env.VITE_SITE_URL ||
  process.env.SITEMAP_SITE_URL ||
  "https://www.trueprice.cash"
)
  .trim()
  .replace(/\/+$/, "");

configureSeoSiteUrl(SITE);

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

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

function sanitizePostHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function hreflangLinks(alternates) {
  if (!alternates) return "";
  return Object.entries(alternates)
    .map(
      ([lang, path]) =>
        `<link rel="alternate" hreflang="${escapeAttr(lang)}" href="${escapeAttr(absoluteCanonicalUrl(SITE, path))}" />`
    )
    .join("\n  ");
}

function pageShell({ locale, seo, bodyHtml, dir }) {
  const canonical = absoluteCanonicalUrl(SITE, seo.pathname);
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
  <meta property="og:image" content="${SITE}/og/default.png" />
  <meta property="og:image:secure_url" content="${SITE}/og/default.png" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${SITE}/og/default.png" />
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
    .hero p { margin: 0.35rem 0 0; color: var(--tp-muted); font-size: 15px; }
    article { background: #fff; border: 1px solid var(--tp-border); border-radius: 12px; padding: 1.25rem 1.35rem; }
    article a { color: var(--tp-primary); }
    article h2 { margin: 1.5rem 0 0.75rem; font-size: 1.25rem; }
    article h3 { margin: 1.25rem 0 0.5rem; font-size: 1.05rem; }
    article p, article li { margin: 0 0 0.85rem; font-size: 15px; }
    .toc { background: #eef5ff; border: 1px solid var(--tp-border); border-radius: 10px; padding: 1rem 1.1rem; margin-bottom: 1.25rem; }
    .toc-title { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #5a7aa8; margin: 0 0 0.5rem; }
    .toc ol { margin: 0; padding-inline-start: 1.25rem; }
    .toc li { margin: 0.25rem 0; font-size: 13px; }
    .callout { margin: 1rem 0; padding: 0.9rem 1rem; border-inline-start: 3px solid var(--tp-primary); background: #eef5ff; border-radius: 10px; }
    .callout-label { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tp-primary); margin-bottom: 0.35rem; }
    .callout p:last-child { margin-bottom: 0; }
    .table-wrap { overflow-x: auto; margin: 1rem 0; border: 1px solid var(--tp-border); border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid var(--tp-border); padding: 0.55rem 0.75rem; text-align: start; vertical-align: top; }
    th { background: #f0f6ff; color: var(--tp-ink); font-size: 12px; }
    tr:last-child td { border-bottom: 0; }
    .pos { color: #0b6b43; font-weight: 700; }
    .neg { color: #b42318; font-weight: 700; }
    .principle-grid, .card-grid, .term-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
    .principle-card, .card, .term-card { padding: 0.85rem; border: 1px solid var(--tp-border); border-radius: 10px; background: #fafcff; }
    .principle-num { margin-bottom: 0.25rem; font-size: 1.35rem; font-weight: 800; line-height: 1; color: var(--tp-primary); direction: ltr; unicode-bidi: isolate; }
    .principle-num.pos { color: #0b6b43; }
    .principle-num.neg { color: #b42318; }
    .num, td.pos, td.neg { direction: ltr; unicode-bidi: isolate; }
    .principle-title, .card h4, .term-name { margin: 0 0 0.35rem; font-size: 13px; font-weight: 800; color: var(--tp-ink); }
    .principle-desc, .card p, .term-def { margin: 0; font-size: 12px; line-height: 1.55; color: var(--tp-muted); }
    .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin: 1rem 0; }
    .compare-card { border: 1px solid var(--tp-border); border-radius: 10px; overflow: hidden; background: #fff; }
    .compare-header { padding: 0.55rem 0.75rem; font-size: 13px; font-weight: 800; }
    .compare-header.value-h { background: #e8f5ee; color: #0b6b43; }
    .compare-header.growth-h { background: #eef5ff; color: var(--tp-primary); }
    .compare-header.risk-h { background: #fce7eb; color: #e63757; }
    .compare-body { padding: 0.35rem 0.75rem 0.65rem; }
    .compare-row { padding: 0.4rem 0; border-bottom: 1px solid var(--tp-border); font-size: 13px; line-height: 1.5; }
    .compare-row:last-child { border-bottom: 0; }
    .steps { display: flex; flex-direction: column; gap: 0.85rem; margin: 1rem 0; }
    .step { display: grid; grid-template-columns: auto 1fr; gap: 0.85rem; align-items: start; }
    .step-num { display: flex; align-items: center; justify-content: center; width: 1.85rem; height: 1.85rem; border-radius: 50%; background: var(--tp-primary); color: #fff; font-size: 12px; font-weight: 800; }
    .step h4 { margin: 0 0 0.35rem; font-size: 14px; }
    .step p { margin: 0; }
    .series-complete { margin-top: 1.5rem; padding: 1.35rem 1.25rem; border-radius: 12px; background: linear-gradient(140deg, #1a2b42, #2c7be5); color: #fff; text-align: center; }
    .series-complete h3 { margin: 0 0 0.5rem; color: #fff; }
    .series-complete p { margin: 0 auto; max-width: 36rem; color: #e8f2ff; }
    .sources { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--tp-border); font-size: 14px; }
    @media (max-width: 640px) { .compare-grid { grid-template-columns: 1fr; } }
    .catalog { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.65rem; }
    .catalog a { display: block; padding: 0.85rem 1rem; background: #fff; border: 1px solid var(--tp-border); border-radius: 10px; color: var(--tp-ink); text-decoration: none; }
    .catalog a strong { display: block; font-size: 1.05rem; }
    .catalog a span { display: block; margin-top: 0.35rem; color: var(--tp-muted); font-size: 14px; font-weight: 400; }
    footer { margin-top: 2rem; text-align: center; font-size: 12px; color: var(--tp-muted); }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="site">
      <a class="brand" href="/">TruePrice.Cash</a>
      <div>
        <a href="${blogIndexPath("en")}">English</a>
        ·
        <a href="${blogIndexPath("ar")}">العربية</a>
        ·
        <a href="${tutorialIndexPath(locale)}">${locale === "ar" ? "الدروس" : "Tutorials"}</a>
        ·
        <a href="/">${locale === "ar" ? "الرئيسية" : "Home"}</a>
      </div>
    </header>
    ${bodyHtml}
    <footer>© TruePrice.Cash</footer>
  </div>
</body>
</html>`;
}

function clearStalePostFiles(locale, slugs) {
  const dir = join(PUBLIC, locale, "blog");
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".html")) continue;
    const slug = name.slice(0, -".html".length);
    if (!slugs.has(slug)) unlinkSync(join(dir, name));
  }
}

function writePostPage(post) {
  const safePost = { ...post, content: sanitizePostHtml(post.content) };
  const seo = buildBlogPostSeo({ post: safePost, lang: safePost.locale });
  const dir = safePost.locale === "ar" ? "rtl" : "ltr";
  const tutorialHref = safePost.relatedTutorial
    ? tutorialArticlePath(safePost.locale, safePost.relatedTutorial)
    : "";
  const tutorialLabel =
    safePost.locale === "ar" ? "تابع في سلسلة الدروس" : "Continue in the tutorial series";
  const meta = [safePost.published ? String(safePost.published).slice(0, 10) : "", safePost.readingTime, safePost.level]
    .filter(Boolean)
    .join(" · ");
  const inner = `<div class="hero">
      <p style="font-size:13px;margin:0 0 0.5rem;"><a href="${blogIndexPath(safePost.locale)}">${safePost.locale === "ar" ? "المدونة" : "Blog"}</a></p>
      <h1>${safePost.titleHtml || escapeHtml(safePost.title)}</h1>
      <p>${escapeHtml(meta)}</p>
      ${safePost.subtitle ? `<p>${escapeHtml(safePost.subtitle)}</p>` : ""}
    </div>
    <article>
      ${safePost.content}
      ${tutorialHref ? `<p style="margin-top:1.5rem;font-size:13px;"><a href="${escapeAttr(tutorialHref)}">${escapeHtml(tutorialLabel)}</a></p>` : ""}
    </article>`;
  const outDir = join(PUBLIC, post.locale, "blog");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${safePost.slug}.html`), pageShell({ locale: safePost.locale, seo, bodyHtml: inner, dir }), "utf8");
}

function writeIndexPage(locale, posts) {
  const seo = buildBlogsSeo({
    lang: locale,
    posts: posts.map((post) => ({
      id: post.id,
      title: post.title,
      path: post.path,
      slug: post.slug,
      published: post.published,
      updated: post.updated,
      author: post.author,
    })),
    postsCount: posts.length,
  });
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isAr = locale === "ar";
  const list = posts.length
    ? posts
        .map(
          (post) =>
            `<li><a href="${post.path}"><strong>${escapeHtml(post.title)}</strong><span>${escapeHtml(post.excerpt || "")}</span></a></li>`
        )
        .join("\n      ")
    : `<li><a href="${blogIndexPath(locale)}"><strong>${isAr ? "لا توجد مقالات بعد" : "No posts yet"}</strong><span>${escapeHtml(seo.metaDescription)}</span></a></li>`;
  const inner = `<div class="hero">
      <h1>${escapeHtml(seo.title)}</h1>
      <p>${escapeHtml(seo.metaDescription)}</p>
    </div>
    <ol class="catalog">${list}</ol>`;
  const outDir = join(PUBLIC, locale, "blogs");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({ locale, seo, bodyHtml: inner, dir }), "utf8");
}

function main() {
  loadEnvFile(join(ROOT, ".env"));
  loadEnvFile(join(ROOT, "server", ".env"));
  configureSeoSiteUrl(SITE);

  const posts = flattenBlogPosts().map((post) => ({
    ...post,
    content: sanitizePostHtml(post.content),
  }));

  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "src/data/blogs/posts.js",
        posts,
      },
      null,
      2
    ),
    "utf8"
  );

  for (const locale of ["en", "ar"]) {
    const localePosts = posts
      .filter((post) => post.locale === locale)
      .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")));
    writeIndexPage(locale, localePosts);
    clearStalePostFiles(locale, new Set(localePosts.map((post) => post.slug)));
    for (const post of localePosts) writePostPage(post);
  }

  console.log(`[blog-static] Wrote ${posts.length} hardcoded post pages plus en/ar indexes. Canonical host: ${SITE}`);
}

try {
  main();
} catch (err) {
  console.error("[blog-static]", err);
  process.exit(1);
}
