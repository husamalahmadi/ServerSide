/** Safe in-app path for post-OAuth redirect (relative only, no open redirects). */
export function sanitizeOAuthReturnPath(path) {
  if (typeof path !== "string") return "/";
  const raw = path.trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (/[\s\\]/.test(raw)) return "/";

  const qIdx = raw.indexOf("?");
  const pathname = (qIdx >= 0 ? raw.slice(0, qIdx) : raw) || "/";
  let search = qIdx >= 0 ? raw.slice(qIdx + 1) : "";

  if (search) {
    const sp = new URLSearchParams(search);
    sp.delete("tp_session");
    sp.delete("auth");
    const rest = sp.toString();
    search = rest ? `?${rest}` : "";
  }

  if (pathname.startsWith("/auth")) return "/";
  return pathname + search;
}

export const OAUTH_RETURN_STORAGE_KEY = "tp_oauth_return";

export function stashOAuthReturn(path) {
  try {
    sessionStorage.setItem(OAUTH_RETURN_STORAGE_KEY, sanitizeOAuthReturnPath(path));
  } catch {
    /* private mode / blocked */
  }
}

export function takeOAuthReturn(fallback = "/") {
  try {
    const raw = sessionStorage.getItem(OAUTH_RETURN_STORAGE_KEY);
    sessionStorage.removeItem(OAUTH_RETURN_STORAGE_KEY);
    if (raw) return sanitizeOAuthReturnPath(raw);
  } catch {
    /* ignore */
  }
  return sanitizeOAuthReturnPath(fallback);
}
