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
 * resolvedTicker (catalog symbol, e.g. BRK-B) replaces aliases such as BRK.B.
 * Null when the request is already canonical.
 * Callers must not redirect a ticker that did not resolve; see stockRequestAction.
 */
export function canonicalStockRedirect(pathname, langQuery, resolvedTicker) {
  const parsed = parseStockPath(pathname);
  if (!parsed?.ticker) return null;
  const q = String(langQuery ?? "").trim().toLowerCase();
  const queryLocale = q === "ar" || q === "en" ? q : "";
  const locale = queryLocale || parsed.locale || "en";
  const symbol = String(resolvedTicker || parsed.ticker).trim() || parsed.ticker;
  const target = stockPath(locale, symbol);
  const path = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (queryLocale || path !== target) return target;
  return null;
}

/**
 * How the server should answer a stock URL.
 * Unresolved tickers stay on the URL Google crawled (410) instead of
 * 301-ing to /en/stock/<junk>, which only creates a second Not found URL.
 * lookupFailed keeps the locale redirect when the catalog cannot be read.
 */
export function stockRequestAction(pathname, langQuery, resolvedTicker, lookupFailed = false) {
  const parsed = parseStockPath(pathname);
  if (!parsed?.ticker) return { type: "continue" };
  if (!lookupFailed && !resolvedTicker) return { type: "gone" };
  const target = canonicalStockRedirect(pathname, langQuery, resolvedTicker);
  if (target) return { type: "redirect", target };
  return { type: "continue" };
}
