/** Locale-prefixed blog URL helpers (shared by client, server, sitemap). */

export function blogLocale(lang) {
  return lang === "ar" ? "ar" : "en";
}

export function blogIndexPath(locale = "en") {
  return `/${blogLocale(locale)}/blogs`;
}

export function blogPostPath(locale, slug) {
  return `/${blogLocale(locale)}/blog/${encodeURIComponent(String(slug || "").trim())}`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseBlogPath(pathname) {
  const path = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (path === "/blogs") return { locale: "en", slug: null };
  const indexMatch = path.match(/^\/(en|ar)\/blogs$/i);
  if (indexMatch) return { locale: indexMatch[1].toLowerCase(), slug: null };
  const postMatch = path.match(/^\/(en|ar)\/blog\/([^/]+)$/i);
  if (postMatch) {
    return {
      locale: postMatch[1].toLowerCase(),
      slug: safeDecode(postMatch[2]),
    };
  }
  return null;
}
