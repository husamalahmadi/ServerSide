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

/**
 * API base URL. In the browser, if VITE_API_URL points at localhost or 127.0.0.1,
 * the hostname is aligned with window.location.hostname so session cookies from
 * Google OAuth (which bind to the host you used) match fetch targets — mixing
 * localhost vs 127.0.0.1 otherwise drops auth on POST /api/... (e.g. comments).
 */
export function getApiUrl() {
  let u = get("VITE_API_URL", "http://localhost:3001").replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.hostname) {
    try {
      const parsed = new URL(u);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        parsed.hostname = window.location.hostname;
        u = parsed.toString().replace(/\/+$/, "");
      }
    } catch {
      /* ignore invalid VITE_API_URL */
    }
  }
  return u;
}
