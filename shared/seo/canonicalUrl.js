/**
 * Canonical paths must match sitemap <loc> values byte for byte.
 * Google reports "Alternate page with proper canonical tag" when the tag
 * points at a different string — including Unicode vs percent-encoding,
 * or a trailing slash the sitemap does not use.
 */

export function canonicalPathname(pathname = "/") {
  let path = String(pathname ?? "/").split("#")[0].split("?")[0].trim();
  if (!path) path = "/";
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep the raw path when it is not valid percent-encoding */
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path === "/") return "/";

  return path
    .split("/")
    .map((segment, index) => (index === 0 ? "" : encodeURIComponent(segment)))
    .join("/");
}

/** Absolute canonical URL. Homepage keeps a trailing slash; every other path does not. */
export function absoluteCanonicalUrl(origin, pathname = "/") {
  const raw = String(pathname ?? "").trim();
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return absoluteCanonicalUrl(`${url.protocol}//${url.host}`, url.pathname);
    } catch {
      /* fall through and treat it as a path */
    }
  }
  const base = String(origin || "").trim().replace(/\/+$/, "");
  const path = canonicalPathname(raw || "/");
  return path === "/" ? `${base}/` : `${base}${path}`;
}
