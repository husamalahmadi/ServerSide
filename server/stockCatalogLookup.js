import { loadGroupedCatalog } from "./buildScreenerFromFmp.js";
import { SCREENER_MARKETS } from "./screenerStore.js";

export const CURRENCY_BY_MARKET = { us: "USD", sa: "SAR", jp: "JPY", uk: "GBP" };

let catalogPools = null;

function buildPools() {
  const pools = {};
  for (const market of SCREENER_MARKETS) {
    const entries = loadGroupedCatalog(market);
    const byUpperTicker = new Map();
    const upperSet = new Set();
    for (const e of entries) {
      const item = {
        ticker: e.ticker,
        name: e.name,
        industry: e.sector || "",
        market,
      };
      const up = String(item.ticker).toUpperCase();
      byUpperTicker.set(up, item);
      upperSet.add(up);
    }
    pools[market] = { byUpperTicker, upperSet };
  }
  return pools;
}

/** In-memory catalog index (built once on first stock SEO request). */
export function getCatalogPools() {
  if (!catalogPools) catalogPools = buildPools();
  return catalogPools;
}

function findInPools(cat, rawTicker) {
  const up = String(rawTicker || "").trim().toUpperCase();
  if (!up) return null;

  if (cat.us.byUpperTicker.has(up)) return { market: "us", hit: cat.us.byUpperTicker.get(up) };
  if (cat.sa.byUpperTicker.has(up)) return { market: "sa", hit: cat.sa.byUpperTicker.get(up) };
  if (cat.jp.byUpperTicker.has(up)) return { market: "jp", hit: cat.jp.byUpperTicker.get(up) };
  if (cat.uk.byUpperTicker.has(up)) return { market: "uk", hit: cat.uk.byUpperTicker.get(up) };

  const upDotT = `${up}.T`;
  if (cat.jp.byUpperTicker.has(upDotT)) return { market: "jp", hit: cat.jp.byUpperTicker.get(upDotT) };

  const upDotL = `${up}.L`;
  if (!up.endsWith(".L") && cat.uk.byUpperTicker.has(upDotL)) {
    return { market: "uk", hit: cat.uk.byUpperTicker.get(upDotL) };
  }

  return null;
}

/**
 * Resolve a URL ticker to catalog entry (US / SA / JP / UK).
 * Handles bare vs .T / .L suffixes and optional .SR on Saudi tickers.
 */
export function findStockByTicker(rawTicker) {
  const cat = getCatalogPools();
  const decoded = String(rawTicker || "").trim();
  if (!decoded) return null;

  let found = findInPools(cat, decoded);
  if (found) return found;

  const upper = decoded.toUpperCase();
  if (upper.endsWith(".SR")) {
    found = findInPools(cat, upper.slice(0, -3));
    if (found) return found;
  }

  return null;
}
