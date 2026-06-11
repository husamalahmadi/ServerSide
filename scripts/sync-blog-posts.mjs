/**
 * Syncs blog posts from the public Blogger JSON feed into public/data/blog-posts.json.
 * No API key required — uses drsamalahmadi.blogspot.com Atom/JSON feed.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "data", "blog-posts.json");

const FEED_BASE =
  process.env.BLOGGER_FEED_URL ||
  "https://drsamalahmadi.blogspot.com/feeds/posts/default?alt=json";

const ARABIC_RE = /[\u0600-\u06FF]/;

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extractSlug(entry) {
  const alt =
    (entry.link || []).find((l) => l.rel === "alternate")?.href ||
    entry.id?.$t ||
    "";
  const m = String(alt).match(/\/(\d{4})\/(\d{2})\/([^/.?#]+)/);
  if (m) return decodeURIComponent(m[3]);
  return slugify(stripHtml(entry.title?.$t));
}

function detectLang(entry) {
  const labels = (entry.category || []).map((c) =>
    String(c.term || c.$t || "").toLowerCase()
  );
  if (labels.includes("arabic")) return "ar";
  if (labels.includes("english")) return "en";
  const text = `${entry.title?.$t || ""} ${entry.content?.$t || entry.summary?.$t || ""}`;
  return ARABIC_RE.test(text) ? "ar" : "en";
}

function firstImage(html) {
  const m = String(html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function excerptFrom(html, max = 220) {
  const clean = stripHtml(html);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

function normalizeContent(html) {
  const raw = String(html || "");
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();
  return raw;
}

async function fetchFeedPage(startIndex = 1, maxResults = 150) {
  const u = new URL(FEED_BASE);
  u.searchParams.set("max-results", String(maxResults));
  u.searchParams.set("start-index", String(startIndex));
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
  return res.json();
}

async function fetchAllEntries() {
  const all = [];
  let startIndex = 1;
  const pageSize = 150;

  for (;;) {
    const json = await fetchFeedPage(startIndex, pageSize);
    const entries = json.feed?.entry || [];
    if (!entries.length) break;
    all.push(...entries);
    const total = Number(json.feed?.openSearch$totalResults?.$t || 0);
    startIndex += entries.length;
    if (startIndex > total || entries.length < pageSize) break;
  }

  return all;
}

function uniqueSlugs(entries) {
  const used = new Map();
  return entries.map((entry) => {
    let slug = extractSlug(entry);
    if (!slug) slug = `post-${String(entry.id?.$t || "").slice(-8)}`;
    const base = slug;
    let n = 1;
    while (used.has(slug)) {
      slug = `${base}-${++n}`;
    }
    used.set(slug, true);
    return slug;
  });
}

async function main() {
  console.log("[blog-sync] Fetching posts from Blogger feed…");
  const entries = await fetchAllEntries();
  console.log(`[blog-sync] Found ${entries.length} raw entries`);

  const slugs = uniqueSlugs(entries);
  const posts = entries.map((entry, i) => {
    const content = normalizeContent(entry.content?.$t || entry.summary?.$t || "");
    const titleHtml = entry.title?.$t || "";
    const lang = detectLang(entry);
    const sourceUrl =
      (entry.link || []).find((l) => l.rel === "alternate")?.href ||
      entry.id?.$t ||
      "";

    return {
      id: String(entry.id?.$t || slugs[i]),
      slug: slugs[i],
      lang,
      title: stripHtml(titleHtml),
      titleHtml,
      content,
      excerpt: excerptFrom(content),
      published: entry.published?.$t || null,
      updated: entry.updated?.$t || entry.published?.$t || null,
      author: entry.author?.[0]?.name?.$t || "Dr. Sam Al Ahmadi",
      sourceUrl,
      heroImage: firstImage(content),
      labels: (entry.category || []).map((c) => c.term || c.$t).filter(Boolean),
    };
  });

  posts.sort((a, b) => {
    const ta = a.published ? new Date(a.published).getTime() : 0;
    const tb = b.published ? new Date(b.published).getTime() : 0;
    return tb - ta;
  });

  const manifest = {
    updatedAt: new Date().toISOString(),
    source: FEED_BASE.split("?")[0],
    count: posts.length,
    posts,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(manifest, null, 2), "utf8");

  const en = posts.filter((p) => p.lang === "en").length;
  const ar = posts.filter((p) => p.lang === "ar").length;
  console.log(`[blog-sync] Wrote ${OUT} (${posts.length} posts: ${en} en, ${ar} ar)`);
}

main().catch((err) => {
  console.error("[blog-sync] Failed:", err);
  process.exit(1);
});
