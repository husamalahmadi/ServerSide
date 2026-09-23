let cached = null;

/** Posts generated into public/data/blog-posts.json at build time. */
export async function loadBlogPosts() {
  if (cached) return cached;
  const res = await fetch("/data/blog-posts.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  cached = Array.isArray(data.posts) ? data.posts : [];
  return cached;
}
