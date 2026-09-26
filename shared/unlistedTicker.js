/**
 * Symbols shown on the site (screener, gainers, losers) that are not in the
 * S&P 500 / TASI / Tokyo / London catalog files. They still resolve to a market
 * so the stock page can load Financial Modeling Prep data.
 */

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]*$/;

export function inferUnlistedListing(rawTicker) {
  const upper = String(rawTicker || "").trim().toUpperCase();
  if (!upper || upper.length > 15 || !TICKER_RE.test(upper)) return null;
  if (upper.endsWith(".") || upper.endsWith("-")) return null;

  if (upper.endsWith(".SR")) {
    const base = upper.slice(0, -3);
    if (!/^\d{1,6}$/.test(base)) return null;
    return { ticker: base, name: base, market: "sa", fmpSymbol: `${base}.SR`, currency: "SAR" };
  }

  if (upper.endsWith(".T")) {
    const base = upper.slice(0, -2);
    if (!/^\d{3,5}$/.test(base)) return null;
    return { ticker: upper, name: upper, market: "jp", fmpSymbol: upper, currency: "JPY" };
  }

  if (upper.endsWith(".L")) {
    const base = upper.slice(0, -2);
    if (!/^[A-Z0-9][A-Z0-9.\-]{0,12}$/.test(base)) return null;
    return { ticker: upper, name: upper, market: "uk", fmpSymbol: upper, currency: "GBP" };
  }

  // US listings, including class shares (BRK-B) outside the S&P 500 file.
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(upper)) return null;
  const classDot = upper.match(/^([A-Z0-9]+)\.([A-Z])$/);
  const fmpSymbol = classDot ? `${classDot[1]}-${classDot[2]}` : upper;
  return { ticker: upper, name: upper, market: "us", fmpSymbol, currency: "USD" };
}

/** Catalog keys for class-share punctuation (BRK-B vs BRK.B). */
export function classShareAliases(rawTicker) {
  const up = String(rawTicker || "").trim().toUpperCase();
  if (!up) return [];
  const keys = [up];
  const hyphen = up.match(/^(.*)-([A-Z])$/);
  if (hyphen) keys.push(`${hyphen[1]}.${hyphen[2]}`);
  const dot = up.match(/^(.*)\.([A-Z])$/);
  if (dot && !up.endsWith(".T") && !up.endsWith(".L") && !up.endsWith(".SR")) {
    keys.push(`${dot[1]}-${dot[2]}`);
  }
  return keys;
}
