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

/** True if API base URL is known: build-time VITE_API_URL or public/runtime-config.js. */
export function hasExplicitViteApiUrl() {
  if (!!(import.meta.env.VITE_API_URL ?? "").toString().trim()) return true;
  if (typeof window !== "undefined") {
    const rt = (window.__TP_PUBLIC_API_URL__ ?? "").toString().trim();
    if (rt) return true;
  }
  return false;
}

function getResolvedApiUrlString() {
  let s = (import.meta.env.VITE_API_URL ?? "").toString().trim();
  if (typeof window !== "undefined") {
    const rt = (window.__TP_PUBLIC_API_URL__ ?? "").toString().trim();
    if (rt) s = rt;
  }
  return s;
}

/**
 * API base URL. In the browser, if VITE_API_URL points at localhost or 127.0.0.1,
 * the hostname is aligned with window.location.hostname so session cookies from
 * Google OAuth (which bind to the host you used) match fetch targets — mixing
 * localhost vs 127.0.0.1 otherwise drops auth on POST /api/... (e.g. comments).
 *
 * Production: if VITE_API_URL is unset, default to same origin (not localhost:3001),
 * so deploys (e.g. Vercel) never build URLs like https://app.vercel.app:3001 (invalid).
 * For a separate API host, set VITE_API_URL in the host dashboard (e.g. Railway URL).
 */
export function getApiUrl() {
  let fromEnv = getResolvedApiUrlString();
  let u;
  if (fromEnv) {
    u = fromEnv.replace(/\/+$/, "");
  } else if (typeof window !== "undefined" && import.meta.env.PROD) {
    u = window.location.origin.replace(/\/+$/, "");
  } else {
    u = "http://localhost:3001".replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.hostname) {
    try {
      const pageHost = window.location.hostname;
      const pageIsLocal =
        pageHost === "localhost" || pageHost === "127.0.0.1";
      const parsed = new URL(u, window.location.origin);

      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        parsed.hostname = pageHost;
        // Do not keep dev API port (3001) when mapping to a real deployed hostname;
        // Vercel/static hosts only serve HTTPS on 443, not :3001.
        if (!pageIsLocal) {
          parsed.port = "";
          if (window.location.protocol === "https:") {
            parsed.protocol = "https:";
          }
        }
        u = parsed.toString().replace(/\/+$/, "");
      }

      // Env may wrongly set full URL to https://<vercel-host>:3001 (host is not "localhost",
      // so the branch above never runs). Strip dev ports whenever API host === page host.
      const normalized = new URL(u, window.location.origin);
      if (
        !pageIsLocal &&
        normalized.hostname === pageHost &&
        (normalized.port === "3001" ||
          normalized.port === "3000" ||
          normalized.port === "5173")
      ) {
        normalized.port = "";
        if (window.location.protocol === "https:") {
          normalized.protocol = "https:";
        }
        u = normalized.toString().replace(/\/+$/, "");
      }
    } catch {
      /* ignore invalid VITE_API_URL */
    }
  }
  return u;
}
