/**
 * Centralized env/config access.
 * Validates required keys when getters are called (lazy).
 */

function get(key, defaultValue = "") {
  const v = (import.meta.env[key] ?? defaultValue).toString().trim();
  return v;
}

export function getTwelveDataApiKey() {
  const k = get("VITE_TWELVEDATA_API_KEY");
  if (!k) throw new Error("Missing VITE_TWELVEDATA_API_KEY in .env");
  return k;
}

export function getBloggerBlogId() {
  const id = get("VITE_BLOGGER_BLOG_ID");
  if (!id) throw new Error("Missing VITE_BLOGGER_BLOG_ID in .env");
  return id;
}

export function getBloggerApiKey() {
  const key = get("VITE_BLOGGER_API_KEY");
  if (!key) throw new Error("Missing VITE_BLOGGER_API_KEY in .env");
  return key;
}

export function getWeb3FormsKey() {
  return get("VITE_WEB3FORMS_KEY");
}

export function getWeb3FormsTo() {
  return get("VITE_WEB3FORMS_TO");
}

export function getPrefetchDelayMs() {
  const n = Number(import.meta.env.VITE_PREFETCH_DELAY_MS);
  return Number.isFinite(n) && n >= 0 ? n : 5000;
}

export function getBaseUrl() {
  return get("BASE_URL", "/");
}
