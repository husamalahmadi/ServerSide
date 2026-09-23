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

/** 301 target for /stock/:ticker?lang=ar. Null when the request should stay. */
export function legacyArabicStockRedirect(pathname, langQuery) {
  const parsed = parseStockPath(pathname);
  if (!parsed || parsed.locale) return null;
  if (String(langQuery || "").toLowerCase() !== "ar") return null;
  return stockPath("ar", parsed.ticker);
}
