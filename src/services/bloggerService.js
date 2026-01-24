// FILE: client/src/services/bloggerService.js
/**
 * Blogger API v3 client for fetching blog posts.
 * Filters posts by language based on labels.
 */

const BLOGGER_API_BASE = "https://www.googleapis.com/blogger/v3";

function getBlogId() {
  const id = (import.meta.env.VITE_BLOGGER_BLOG_ID || "").trim();
  if (!id) throw new Error("Missing VITE_BLOGGER_BLOG_ID in .env");
  return id;
}

function getApiKey() {
  const key = (import.meta.env.VITE_BLOGGER_API_KEY || "").trim();
  if (!key) throw new Error("Missing VITE_BLOGGER_API_KEY in .env");
  return key;
}

async function fetchJson(url) {
  let res;
  try {
    console.log(`[Blogger] Fetching URL: ${url.replace(/key=[^&]+/, "key=***")}`);
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    console.error(`[Blogger] Network error:`, e);
    throw new Error(`Network error: ${e.message || "Failed to fetch"}`);
  }
  
  const txt = await res.text();
  let json = {};
  try {
    json = txt ? JSON.parse(txt) : {};
  } catch {
    console.error(`[Blogger] JSON parse error. Status: ${res.status}, Response: ${txt?.slice(0, 200)}`);
    throw new Error(`Bad JSON response ${res.status}: ${txt?.slice(0, 150)}`);
  }
  
  if (!res.ok) {
    const errorMsg = json?.error?.message || json?.message || `HTTP ${res.status}`;
    const errorDetails = json?.error?.errors?.[0]?.message || "";
    console.error(`[Blogger] API error:`, { status: res.status, error: json?.error, message: errorMsg });
    throw new Error(`${errorMsg}${errorDetails ? ` - ${errorDetails}` : ""}`);
  }
  console.log(`[Blogger] API response OK, status: ${res.status}`);
  return json;
}

function buildUrl(pathname, params) {
  const u = new URL(BLOGGER_API_BASE + pathname);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === "") continue;
    sp.set(k, String(v));
  }
  sp.set("key", getApiKey());
  u.search = sp.toString();
  return u.toString();
}

/**
 * Fetches blog posts from Blogger.
 * @param {Object} options
 * @param {string} options.lang - 'en' or 'ar' to filter by language label
 * @param {number} options.maxResults - Maximum number of posts (default: 50)
 * @returns {Promise<Array>} Array of blog posts
 */
export async function getBlogPosts({ lang = "en", maxResults = 50 } = {}) {
  let blogId;
  let apiKey;
  
  try {
    blogId = getBlogId();
    apiKey = getApiKey();
    console.log(`[Blogger] Config loaded - Blog ID: ${blogId}, API Key: ${apiKey ? "***" + apiKey.slice(-4) : "MISSING"}`);
  } catch (e) {
    console.error(`[Blogger] Configuration error:`, e);
    throw new Error(`Configuration error: ${e.message}. Please check your .env file.`);
  }
  
  // Language labels: 'english' or 'arabic' (case-insensitive matching)
  const langLabel = lang === "ar" ? "arabic" : "english";
  console.log(`[Blogger] Language: ${lang}, Label: ${langLabel}`);
  
  const url = buildUrl(`/blogs/${blogId}/posts`, {
    maxResults,
    fetchBodies: true, // Fetch content for excerpts
    fetchImages: true,
    labels: langLabel,
  });

  try {
    console.log(`[Blogger] Fetching posts for blog ${blogId} with label "${langLabel}"...`);
    const json = await fetchJson(url);
    const items = json?.items || [];
    console.log(`[Blogger] Found ${items.length} posts with label "${langLabel}"`);
    
    if (items.length === 0) {
      console.log("[Blogger] No posts found with label filter, trying fallback method...");
      return getBlogPostsFallback({ blogId, langLabel, maxResults });
    }
    
    // Transform Blogger post format to our format
    const posts = items.map((post) => ({
      id: post.id,
      title: post.title || "",
      content: post.content || "",
      published: post.published ? new Date(post.published) : null,
      updated: post.updated ? new Date(post.updated) : null,
      url: post.url || "",
      labels: post.labels || [],
      author: post.author?.displayName || "",
      images: post.images || [],
    }));
    
    console.log(`[Blogger] Sample post labels:`, posts[0]?.labels || "No labels found");
    return posts;
  } catch (e) {
    // If label filtering fails, try fetching all and filter client-side
    const errorMsg = e.message?.toLowerCase() || "";
    console.log(`[Blogger] Label filtering failed: ${e.message}, trying fallback method...`);
    if (errorMsg.includes("label") || errorMsg.includes("404") || errorMsg.includes("not found")) {
      return getBlogPostsFallback({ blogId, langLabel, maxResults });
    }
    throw e;
  }
}

/**
 * Test function: fetch all posts without label filtering (for debugging)
 */
export async function getAllBlogPosts({ maxResults = 50 } = {}) {
  let blogId;
  let apiKey;
  
  try {
    blogId = getBlogId();
    apiKey = getApiKey();
  } catch (e) {
    throw new Error(`Configuration error: ${e.message}. Please check your .env file.`);
  }
  
  const url = buildUrl(`/blogs/${blogId}/posts`, {
    maxResults,
    fetchBodies: true,
    fetchImages: true,
  });

  console.log(`[Blogger] Fetching ALL posts (no label filter)...`);
  const json = await fetchJson(url);
  const items = json?.items || [];
  console.log(`[Blogger] Found ${items.length} total posts (no filter)`);
  
  return items.map((post) => ({
    id: post.id,
    title: post.title || "",
    content: post.content || "",
    published: post.published ? new Date(post.published) : null,
    updated: post.updated ? new Date(post.updated) : null,
    url: post.url || "",
    labels: post.labels || [],
    author: post.author?.displayName || "",
    images: post.images || [],
  }));
}

/**
 * Fallback: fetch all posts and filter by label client-side.
 */
async function getBlogPostsFallback({ blogId, langLabel, maxResults }) {
  const url = buildUrl(`/blogs/${blogId}/posts`, {
    maxResults: maxResults * 2, // Fetch more to account for filtering
    fetchBodies: true, // Fetch content for excerpts
    fetchImages: true,
  });

  console.log(`[Blogger] Fetching all posts for blog ${blogId} (fallback method)...`);
  const json = await fetchJson(url);
  const items = json?.items || [];
  console.log(`[Blogger] Found ${items.length} total posts`);
  
  if (items.length === 0) {
    console.warn(`[Blogger] No posts found for blog ${blogId}. Make sure the blog is public and has posts.`);
    return [];
  }
  
  // Check if posts have labels
  const samplePost = items[0];
  const hasLabels = Array.isArray(samplePost?.labels) && samplePost.labels.length > 0;
  console.log(`[Blogger] Posts have labels: ${hasLabels}`, samplePost?.labels || "No labels field");
  
  // If no labels, detect language from content
  if (!hasLabels) {
    console.log(`[Blogger] No labels found, detecting language from content...`);
    return detectLanguageFromContent({ items, langLabel, maxResults });
  }
  
  // Filter by language label (case-insensitive)
  const langLower = langLabel.toLowerCase();
  const filtered = items.filter((post) => {
    const labels = (post.labels || []).map((l) => String(l).toLowerCase());
    return labels.includes(langLower);
  }).slice(0, maxResults);

  console.log(`[Blogger] Filtered to ${filtered.length} posts with label "${langLabel}"`);

  if (filtered.length === 0) {
    const allLabels = [...new Set(items.flatMap(p => (p.labels || [])))];
    console.warn(`[Blogger] No posts found with label "${langLabel}". Available labels:`, allLabels);
    console.warn(`[Blogger] Trying language detection from content instead...`);
    return detectLanguageFromContent({ items, langLabel, maxResults });
  }

  return filtered.map((post) => ({
    id: post.id,
    title: post.title || "",
    content: post.content || "",
    published: post.published ? new Date(post.published) : null,
    updated: post.updated ? new Date(post.updated) : null,
    url: post.url || "",
    labels: post.labels || [],
    author: post.author?.displayName || "",
    images: post.images || [],
  }));
}

/**
 * Detect language from post content when labels are not available.
 * Uses simple heuristics: Arabic text detection vs English.
 */
function detectLanguageFromContent({ items, langLabel, maxResults }) {
  const isArabic = langLabel === "arabic";
  
  // Arabic Unicode range: \u0600-\u06FF
  const arabicRegex = /[\u0600-\u06FF]/;
  
  const filtered = items.filter((post) => {
    const title = post.title || "";
    const content = post.content || "";
    const combined = `${title} ${content}`;
    const hasArabic = arabicRegex.test(combined);
    
    // If looking for Arabic, return posts with Arabic text
    // If looking for English, return posts without Arabic text
    return isArabic ? hasArabic : !hasArabic;
  }).slice(0, maxResults);
  
  console.log(`[Blogger] Language detection: Found ${filtered.length} ${isArabic ? "Arabic" : "English"} posts`);
  
  return filtered.map((post) => ({
    id: post.id,
    title: post.title || "",
    content: post.content || "",
    published: post.published ? new Date(post.published) : null,
    updated: post.updated ? new Date(post.updated) : null,
    url: post.url || "",
    labels: post.labels || [],
    author: post.author?.displayName || "",
    images: post.images || [],
  }));
}
