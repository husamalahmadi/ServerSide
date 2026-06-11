// FILE: src/data/stocksCatalog.js
import { publicUrl } from "../utils/publicUrl.js";

const DATA_FILES = {
  us: publicUrl("data/sp500_grouped_by_industry.json"),
  sa: publicUrl("data/tasi_grouped_by_industry.json"),
  jp: publicUrl("data/tokyo_stock_exchange.json"),
  uk: publicUrl("data/london_stock_exchange.json"),
};

export const MARKETS = ["us", "sa", "jp", "uk"];

export const CURRENCY_BY_MARKET = { us: "USD", sa: "SAR", jp: "JPY", uk: "GBP" };

async function fetchJson(url, attempt = 0) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const txt = await res.text();
    const trimmed = txt.trim();

    if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
      throw new Error(
        `Catalog data unavailable (HTTP ${res.status}): received HTML instead of JSON. Retry or check hosting.`
      );
    }

    let json = {};
    try {
      json = trimmed ? JSON.parse(trimmed) : {};
    } catch {
      throw new Error(`Invalid catalog JSON (HTTP ${res.status}): ${trimmed.slice(0, 120)}`);
    }

    if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
    return json;
  } catch (err) {
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 800));
      return fetchJson(url, attempt + 1);
    }
    throw err;
  }
}

function normalizeGrouped(grouped, { tickerUppercase, market }) {
  const flat = [];
  const inds = [];

  for (const [industry, items] of Object.entries(grouped || {})) {
    inds.push(industry);
    for (const it of items || []) {
      const rawTicker = String(it?.Ticker ?? it?.ticker ?? "").trim();
      const ticker = tickerUppercase ? rawTicker.toUpperCase() : rawTicker;
      const name = String(it?.Company ?? it?.name ?? "").trim();
      if (!ticker || !name) continue;
      flat.push({ ticker, name, industry, market });
    }
  }

  flat.sort((a, b) => a.ticker.toString().localeCompare(b.ticker.toString()));
  inds.sort((a, b) => a.localeCompare(b));

  const byUpperTicker = new Map();
  const upperSet = new Set();
  for (const it of flat) {
    const up = String(it.ticker).toUpperCase();
    byUpperTicker.set(up, it);
    upperSet.add(up);
  }

  return { list: flat, inds, byUpperTicker, upperSet };
}

let _catalogPromise = null;
async function ensureCatalog() {
  if (_catalogPromise) return _catalogPromise;

  _catalogPromise = (async () => {
    const [usRaw, saRaw, jpRaw, ukRaw] = await Promise.all([
      fetchJson(DATA_FILES.us),
      fetchJson(DATA_FILES.sa),
      fetchJson(DATA_FILES.jp).catch(() => ({})),
      fetchJson(DATA_FILES.uk).catch(() => ({})),
    ]);

    const us = normalizeGrouped(usRaw, { tickerUppercase: true, market: "us" });
    const sa = normalizeGrouped(saRaw, { tickerUppercase: false, market: "sa" });
    const jp = normalizeGrouped(jpRaw, { tickerUppercase: true, market: "jp" });
    const uk = normalizeGrouped(ukRaw, { tickerUppercase: true, market: "uk" });

    return { us, sa, jp, uk };
  })();

  return _catalogPromise;
}

function isMarket(m) {
  return m === "us" || m === "sa" || m === "jp" || m === "uk";
}

export async function getStocks({ market = "us" } = {}) {
  const cat = await ensureCatalog();
  const m = isMarket(market) ? market : "us";
  const pool = cat[m];

  return {
    market: m,
    count: pool.list.length,
    industries: pool.inds,
    items: pool.list,
  };
}

/** Returns all stocks from US, TASI, Tokyo, and London for unified search. */
export async function getAllStocks() {
  const cat = await ensureCatalog();
  const combined = [...cat.us.list, ...cat.sa.list, ...cat.jp.list, ...cat.uk.list];
  const industries = Array.from(
    new Set([...cat.us.inds, ...cat.sa.inds, ...cat.jp.inds, ...cat.uk.inds])
  ).sort((a, b) => a.localeCompare(b));
  return { items: combined, industries };
}

function findInCatalog(cat, rawTicker) {
  const up = String(rawTicker || "").toUpperCase().trim();
  if (!up) return null;
  if (cat.us.byUpperTicker.has(up)) return { market: "us", hit: cat.us.byUpperTicker.get(up) };
  if (cat.sa.byUpperTicker.has(up)) return { market: "sa", hit: cat.sa.byUpperTicker.get(up) };
  if (cat.jp.byUpperTicker.has(up)) return { market: "jp", hit: cat.jp.byUpperTicker.get(up) };
  if (cat.uk.byUpperTicker.has(up)) return { market: "uk", hit: cat.uk.byUpperTicker.get(up) };
  // Tokyo: user might type bare "3823" without ".T"
  const upDotT = `${up}.T`;
  if (cat.jp.byUpperTicker.has(upDotT)) return { market: "jp", hit: cat.jp.byUpperTicker.get(upDotT) };
  // London: user might type bare "GLEN" without ".L"
  const upDotL = `${up}.L`;
  if (!up.endsWith(".L") && cat.uk.byUpperTicker.has(upDotL)) {
    return { market: "uk", hit: cat.uk.byUpperTicker.get(upDotL) };
  }
  return null;
}

export async function getCompany(rawTicker) {
  const cat = await ensureCatalog();
  const found = findInCatalog(cat, rawTicker);
  if (!found) throw new Error("Ticker not found in US/SA/JP/UK lists.");
  return {
    ticker: found.hit.ticker,
    name: found.hit.name,
    market: found.market,
    currency: CURRENCY_BY_MARKET[found.market],
  };
}

/**
 * Resolve a user-entered ticker to a market + FMP symbol + display ticker.
 * `fmpSymbol`: what to send to FMP API (e.g. AAPL, 2222.SR, 7203.T, GLEN.L).
 * `tickerDisplay`: what to show in UI / use as cache key.
 */
export async function resolveMarketAndSymbol(rawTicker, requestedMarket) {
  const cat = await ensureCatalog();
  const upper = String(rawTicker || "").toUpperCase().trim();
  if (!upper) return { ok: false };

  let market = isMarket(requestedMarket) ? requestedMarket : null;
  let resolvedUpper = upper;

  const found = findInCatalog(cat, upper);

  if (!market) {
    if (found) {
      market = found.market;
      resolvedUpper = String(found.hit.ticker).toUpperCase();
    }
  } else if (found && found.market !== market) {
    const pool = cat[market];
    const inRequested =
      pool.upperSet.has(upper) ||
      (market === "jp" && pool.upperSet.has(`${upper}.T`)) ||
      (market === "uk" && pool.upperSet.has(`${upper}.L`));
    if (!inRequested) {
      market = found.market;
      resolvedUpper = String(found.hit.ticker).toUpperCase();
    }
  } else if (market === "jp") {
    if (!cat.jp.upperSet.has(upper) && cat.jp.upperSet.has(`${upper}.T`)) {
      resolvedUpper = `${upper}.T`;
    }
  } else if (market === "uk") {
    if (!cat.uk.upperSet.has(upper) && cat.uk.upperSet.has(`${upper}.L`)) {
      resolvedUpper = `${upper}.L`;
    }
  }

  if (!market) return { ok: false };

  const tickerUS = upper;
  const tickerSA = String(rawTicker || "").trim();
  const tickerJP = market === "jp" ? resolvedUpper : upper;
  const tickerUK = market === "uk" ? resolvedUpper : upper;
  const tickerDisplay =
    market === "us" ? tickerUS : market === "jp" ? tickerJP : market === "uk" ? tickerUK : tickerSA;

  let fmpSymbol;
  if (market === "us") fmpSymbol = tickerUS;
  else if (market === "sa") fmpSymbol = `${tickerSA}.SR`;
  else fmpSymbol = resolvedUpper;

  return {
    ok: true,
    market,
    symbol: fmpSymbol,
    fmpSymbol,
    tickerDisplay,
    tickerUS,
    tickerSA,
    tickerJP,
    tickerUK,
    currency: CURRENCY_BY_MARKET[market],
  };
}

/** Financial Modeling Prep `symbol` for a resolved ticker. */
export function fmpSymbolFromResolved(r) {
  if (!r?.ok) return null;
  return r.fmpSymbol || null;
}
