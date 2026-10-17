/** Locale-prefixed stock URL helpers (shared by client, server, sitemap). */

export function stockLocale(lang) {
  return lang === "ar" ? "ar" : "en";
}

export function stockPath(locale, ticker) {
  const loc = stockLocale(locale);
  const symbol = encodeURIComponent(String(ticker ?? "").trim());
  return `/${loc}/stock/${symbol}`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseStockPath(pathname) {
  const path = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  const prefixed = path.match(/^\/(en|ar)\/stock\/([^/]+)$/i);
  if (prefixed) {
    return {
      locale: prefixed[1].toLowerCase(),
      ticker: safeDecode(prefixed[2]),
    };
  }
  const bare = path.match(/^\/stock\/([^/]+)$/i);
  if (bare) return { locale: null, ticker: safeDecode(bare[1]) };
  return null;
}

/**
 * 301 target when a stock URL is not the canonical locale path.
 * Bare /stock/:ticker goes to /en/stock/:ticker.
 * ?lang=ar or ?lang=en selects the locale and is then stripped.
 * Null when the request is already canonical.
 */
export function canonicalStockRedirect(pathname, langQuery) {
  const parsed = parseStockPath(pathname);
  if (!parsed?.ticker) return null;
  const q = String(langQuery ?? "").trim().toLowerCase();
  const queryLocale = q === "ar" || q === "en" ? q : "";
  const locale = queryLocale || parsed.locale || "en";
  const target = stockPath(locale, parsed.ticker);
  const path = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (queryLocale || path !== target) return target;
  return null;
}
