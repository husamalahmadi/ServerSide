/**
 * Fetches Blogger posts at build time and writes crawlable HTML:
 *   public/{locale}/blogs/index.html
 *   public/{locale}/blog/{slug}.html
 * Also writes public/data/blog-posts.json for the SPA.
 * Each page's rel=canonical points at trueprice.cash, not the Blogger URL.
 *
 * Run: node scripts/generate-blog-static-pages.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blogIndexPath, blogPostPath } from "../shared/seo/blogPaths.js";
import { buildBlogPostSeo, buildBlogsSeo } from "../shared/seo/structuredData.js";
import { configureSeoSiteUrl } from "../shared/seo/siteUrl.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const DATA_FILE = join(PUBLIC, "data", "blog-posts.json");

const SITE = (
  process.env.VITE_SITE_URL ||
  process.env.SITEMAP_SITE_URL ||
  "https://trueprice.cash"
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

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizePostHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<link\b[^>]*rel=["']?canonical["']?[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function excerptFrom(html, locale) {
  let text = stripTags(html);
  const filler =
    locale === "ar"
      ? " مقال من مدونة TruePrice.Cash عن الاستثمار والقيمة العادلة لأسهم تداول والأسواق العالمية."
      : " An article from the TruePrice.Cash blog on fair value, fundamentals, and investing.";
  while (text.length < 140) text = `${text}${filler}`.replace(/\s+/g, " ").trim();
  if (text.length > 160) text = text.slice(0, 160).replace(/\s+\S*$/, "").trim();
  return text || filler.trim();
}

function slugify(input) {
  const raw = String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return raw;
}

function slugFromPost(post, used) {
  let base = "";
  try {
    const last = new URL(post.url).pathname.split("/").filter(Boolean).pop() || "";
    base = slugify(last);
  } catch {
    base = "";
  }
  if (!base) base = slugify(stripTags(post.title));
  if (!base) base = `post-${String(post.id || "item").replace(/[^a-z0-9]+/gi, "").slice(0, 24) || "item"}`;
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

function localesForPost(post) {
  const labels = (post.labels || []).map((label) => String(label).toLowerCase());
  const locales = [];
  if (labels.includes("arabic")) locales.push("ar");
  if (labels.includes("english")) locales.push("en");
  if (locales.length) return locales;
  const hasArabic = /[\u0600-\u06FF]/.test(`${post.title || ""} ${post.content || ""}`);
  return [hasArabic ? "ar" : "en"];
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
    .hero p { margin: 0; color: var(--tp-muted); font-size: 15px; }
    article { background: #fff; border: 1px solid var(--tp-border); border-radius: 12px; padding: 1.25rem 1.35rem; }
    article a { color: var(--tp-primary); }
    article h2 { margin: 1.5rem 0 0.75rem; font-size: 1.25rem; }
    article p { margin: 0 0 0.85rem; font-size: 15px; }
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
        <a href="/">${locale === "ar" ? "الرئيسية" : "Home"}</a>
      </div>
    </header>
    ${bodyHtml}
    <footer>© TruePrice.Cash</footer>
  </div>
</body>
</html>`;
}

async function fetchAllBloggerPosts(blogId, apiKey) {
  const items = [];
  let pageToken = "";
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/posts`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("fetchBodies", "true");
    url.searchParams.set("fetchImages", "true");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("status", "live");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = json?.error?.message || `HTTP ${res.status}`;
      throw new Error(message);
    }
    items.push(...(json.items || []));
    pageToken = json.nextPageToken || "";
    if (!pageToken) break;
  }
  return items.map((post) => ({
    id: post.id,
    title: post.title || "",
    content: post.content || "",
    published: post.published || null,
    updated: post.updated || null,
    url: post.url || "",
    labels: post.labels || [],
    author: post.author?.displayName || "",
  }));
}

function readSnapshot() {
  if (!existsSync(DATA_FILE)) return null;
  try {
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(data.posts) ? data.posts : null;
  } catch {
    return null;
  }
}

function normalizeFetched(rawPosts) {
  const used = { en: new Set(), ar: new Set() };
  const posts = [];
  for (const post of rawPosts) {
    for (const locale of localesForPost(post)) {
      const slug = slugFromPost(post, used[locale]);
      const content = sanitizePostHtml(post.content);
      const title = stripTags(post.title) || slug;
      posts.push({
        id: String(post.id || slug),
        slug,
        locale,
        title,
        content,
        excerpt: excerptFrom(content || title, locale),
        published: post.published,
        updated: post.updated || post.published,
        author: post.author || "",
        bloggerUrl: post.url || "",
        path: blogPostPath(locale, slug),
      });
    }
  }
  posts.sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")));
  return posts;
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
  const canonical = `${SITE}${safePost.path}`;
  const inner = `<div class="hero">
      <p style="font-size:13px;margin:0 0 0.5rem;"><a href="${blogIndexPath(safePost.locale)}">${safePost.locale === "ar" ? "المدونة" : "Blog"}</a></p>
      <h1>${escapeHtml(safePost.title)}</h1>
      <p>${escapeHtml([safePost.published ? String(safePost.published).slice(0, 10) : "", safePost.author].filter(Boolean).join(" · "))}</p>
    </div>
    <article>
      ${safePost.content || `<p>${escapeHtml(safePost.excerpt || "")}</p>`}
      <p style="margin-top:1.5rem;font-size:13px;color:var(--tp-muted);">${safePost.locale === "ar" ? "النسخة الأصلية على هذا الموقع:" : "Canonical copy on this site:"} <a href="${escapeAttr(canonical)}">${escapeHtml(canonical)}</a>${safePost.bloggerUrl ? ` · <a href="${escapeAttr(safePost.bloggerUrl)}" rel="nofollow noopener">Blogger</a>` : ""}</p>
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

async function main() {
  loadEnvFile(join(ROOT, ".env"));
  loadEnvFile(join(ROOT, "server", ".env"));
  const blogId = (process.env.VITE_BLOGGER_BLOG_ID || process.env.BLOGGER_BLOG_ID || "").trim();
  const apiKey = (process.env.VITE_BLOGGER_API_KEY || process.env.BLOGGER_API_KEY || "").trim();

  let posts = [];
  if (blogId && apiKey) {
    try {
      const raw = await fetchAllBloggerPosts(blogId, apiKey);
      posts = normalizeFetched(raw);
      console.log(`[blog-static] Fetched ${raw.length} Blogger posts → ${posts.length} locale pages`);
    } catch (err) {
      const snapshot = readSnapshot();
      console.warn(`[blog-static] Blogger fetch failed (${err.message}). ${snapshot ? "Using previous snapshot." : "Writing empty indexes."}`);
      posts = snapshot || [];
    }
  } else {
    const snapshot = readSnapshot();
    if (snapshot?.length) {
      posts = snapshot;
      console.warn(`[blog-static] No Blogger API credentials. Reused ${posts.length} posts from public/data/blog-posts.json`);
    } else {
      console.warn("[blog-static] No Blogger API credentials. Wrote index pages with the site title and no posts.");
    }
  }

  posts = posts.map((post) => ({ ...post, content: sanitizePostHtml(post.content) }));

  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(
    DATA_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), posts }, null, 2),
    "utf8"
  );

  for (const locale of ["en", "ar"]) {
    const localePosts = posts.filter((post) => post.locale === locale);
    writeIndexPage(locale, localePosts);
    clearStalePostFiles(locale, new Set(localePosts.map((post) => post.slug)));
    for (const post of localePosts) writePostPage(post);
  }

  console.log(`[blog-static] Wrote ${posts.length} post pages plus en/ar indexes. Canonical host: ${SITE}`);
}

main().catch((err) => {
  console.error("[blog-static]", err);
  process.exit(1);
});
