import { publicUrl } from "../utils/publicUrl.js";

let cache = null;
let loadPromise = null;

async function fetchManifest() {
  const url = publicUrl("data/blog-posts.json");
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  const trimmed = txt.trim();

  if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
    throw new Error(`Blog data unavailable (HTTP ${res.status})`);
  }

  let json = {};
  try {
    json = trimmed ? JSON.parse(trimmed) : {};
  } catch {
    throw new Error(`Invalid blog JSON (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  }

  return json;
}

export async function loadBlogManifest() {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = fetchManifest()
      .then((data) => {
        cache = data;
        return data;
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

export async function getBlogPostsByLang(lang) {
  const manifest = await loadBlogManifest();
  const code = lang === "ar" ? "ar" : "en";
  return (manifest.posts || [])
    .filter((p) => p.lang === code)
    .sort((a, b) => {
      const ta = a.published ? new Date(a.published).getTime() : 0;
      const tb = b.published ? new Date(b.published).getTime() : 0;
      return tb - ta;
    });
}

export async function getBlogPostBySlug(slug) {
  const manifest = await loadBlogManifest();
  const key = String(slug || "").trim();
  if (!key) return null;
  return (manifest.posts || []).find((p) => p.slug === key) || null;
}

export function blogPostPath(slug) {
  return `/blogs/${encodeURIComponent(slug)}`;
}
