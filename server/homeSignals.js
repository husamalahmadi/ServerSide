import { FMP_STABLE_BASE } from "./fmpFetch.js";
import { loadGroupedCatalog } from "./buildScreenerFromFmp.js";
import { computeSaMovers } from "./saMarketDashboard.js";
import { fetchAllBatchQuotes, num } from "./fmpBatchQuotes.js";
import { isUsableScreenerRow } from "../src/domain/screenerMetrics.js";

const NEAR_FAIR_MAX_ABS_DISCOUNT = 14;
const NEAR_FAIR_QUOTE_CANDIDATES = 48;

function catalogFmpByTicker(market) {
  const entries = loadGroupedCatalog(market);
  const map = new Map();
  for (const e of entries) {
    const key = market === "sa" ? String(e.ticker) : String(e.ticker).toUpperCase();
    map.set(key, String(e.fmpSymbol || e.ticker).trim().toUpperCase());
  }
  return map;
}

function fmpSymbolForRow(market, symbol, fmpByTicker) {
  const key = market === "sa" ? String(symbol) : String(symbol).toUpperCase();
  return fmpByTicker.get(key) || (market === "sa" ? `${key}.SR` : key);
}

/** Parse % change from FMP mover / batch-quote rows (stable API field names vary). */
function changePctFromRow(row, price) {
  let pct = num(
    row?.changesPercentage ??
      row?.changePercentage ??
      row?.changePercent ??
      row?.percentChange
  );
  const change = num(row?.change);
  const p = price ?? num(row?.price);
  if (pct == null && p != null && p > 0 && change != null) {
    pct = (change / p) * 100;
  }
  return pct;
}

async function fetchFmpStableArray(path, params, apiKey, label) {
  const url = `${FMP_STABLE_BASE}/${path}?${new URLSearchParams({ ...params, apikey: apiKey })}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`FMP ${label} HTTP ${r.status}`);
  let arr;
  try {
    arr = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`FMP ${label}: invalid JSON`);
  }
  if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
    throw new Error(String(arr["Error Message"] || arr.error));
  }
  if (!Array.isArray(arr)) throw new Error(`FMP ${label}: expected array`);
  return arr;
}

function mapUsMover(row) {
  const price = num(row?.price);
  const changesPercentage = changePctFromRow(row, price);
  return {
    symbol: String(row?.symbol ?? "").trim().toUpperCase(),
    name: String(row?.name ?? "").trim(),
    price,
    changesPercentage,
    volume: num(row?.volume),
  };
}

/** Fill missing price / % change from batch quotes. */
async function enrichRowsWithQuotes(rows, market, apiKey) {
  if (!rows?.length) return rows;
  const fmpByTicker = catalogFmpByTicker(market);
  const need = rows.filter(
    (r) =>
      r.symbol &&
      (r.price == null || !Number.isFinite(r.price) || r.changesPercentage == null)
  );
  if (!need.length) return rows;

  const fmpSymbols = need.map((r) => fmpSymbolForRow(market, r.symbol, fmpByTicker));
  const quotes = await fetchAllBatchQuotes(fmpSymbols, apiKey);
  const byFmp = new Map();
  for (const q of quotes) {
    const sym = String(q?.symbol ?? "").toUpperCase();
    if (sym) byFmp.set(sym, q);
  }

  return rows.map((row) => {
    const fmp = fmpSymbolForRow(market, row.symbol, fmpByTicker);
    const q = byFmp.get(fmp);
    if (!q) return row;
    const price = num(q?.price) ?? row.price;
    const changesPercentage = changePctFromRow(q, price) ?? row.changesPercentage;
    return {
      ...row,
      name: row.name || String(q?.name || "").trim() || row.symbol,
      price: price ?? row.price,
      changesPercentage:
        changesPercentage != null ? changesPercentage : row.changesPercentage,
    };
  });
}

/** Near fair value: screener fair value + live quote price (recomputed discount). */
async function buildNearFairList(items, market, apiKey, limit = 8) {
  const fmpByTicker = catalogFmpByTicker(market);
  const candidates = (items || [])
    .filter(isUsableScreenerRow)
    .map((r) => ({
      symbol: market === "sa" ? String(r.ticker) : String(r.ticker).toUpperCase(),
      name: String(r.name || r.ticker),
      fairValue: num(r.fairValue),
      price: num(r.priceApprox),
      discountPct: num(r.discountPct),
    }))
    .filter((r) => r.fairValue != null && r.fairValue > 0);

  if (!candidates.length) return [];

  const ranked = [...candidates]
    .sort((a, b) => {
      const da = a.discountPct != null ? Math.abs(a.discountPct) : 999;
      const db = b.discountPct != null ? Math.abs(b.discountPct) : 999;
      return da - db;
    })
    .slice(0, NEAR_FAIR_QUOTE_CANDIDATES);

  const fmpSymbols = ranked.map((r) => fmpSymbolForRow(market, r.symbol, fmpByTicker));
  const quotes = await fetchAllBatchQuotes(fmpSymbols, apiKey);
  const byFmp = new Map();
  for (const q of quotes) {
    const sym = String(q?.symbol ?? "").toUpperCase();
    if (sym) byFmp.set(sym, q);
  }

  const out = [];
  for (const row of ranked) {
    const fmp = fmpSymbolForRow(market, row.symbol, fmpByTicker);
    const q = byFmp.get(fmp);
    const price = num(q?.price) ?? row.price;
    if (price == null || price <= 0) continue;
    const discountPct = ((row.fairValue - price) / price) * 100;
    if (Math.abs(discountPct) > NEAR_FAIR_MAX_ABS_DISCOUNT) continue;
    out.push({
      symbol: row.symbol,
      name: row.name || String(q?.name || "").trim() || row.symbol,
      price: Math.round(price * 100) / 100,
      fairValue: Math.round(row.fairValue * 100) / 100,
      discountPct: Math.round(discountPct * 100) / 100,
    });
  }

  out.sort((a, b) => Math.abs(a.discountPct) - Math.abs(b.discountPct));
  return out.slice(0, limit);
}

/**
 * @param {string} apiKey
 * @param {{ usItems: object[], saItems: object[] }} screenerRows
 */
export async function buildHomeSignals(apiKey, { usItems = [], saItems = [] } = {}) {
  const [gainersArr, saMovers, usNearFair, saNearFair] = await Promise.all([
    fetchFmpStableArray("biggest-gainers", {}, apiKey, "biggest-gainers"),
    computeSaMovers(apiKey),
    buildNearFairList(usItems, "us", apiKey, 8),
    buildNearFairList(saItems, "sa", apiKey, 8),
  ]);

  const topUsGainers = gainersArr
    .map(mapUsMover)
    .filter((r) => r.symbol)
    .sort((a, b) => (b.changesPercentage ?? -Infinity) - (a.changesPercentage ?? -Infinity))
    .slice(0, 8);

  const topSaGainers = saMovers
    .filter((m) => m.changesPercentage != null)
    .sort((a, b) => b.changesPercentage - a.changesPercentage)
    .slice(0, 8)
    .map(({ symbol, name, price, changesPercentage }) => ({
      symbol,
      name,
      price: price > 0 ? price : null,
      changesPercentage,
    }));

  const [usGainers, saGainers] = await Promise.all([
    enrichRowsWithQuotes(topUsGainers, "us", apiKey),
    enrichRowsWithQuotes(topSaGainers, "sa", apiKey),
  ]);

  return {
    updatedAt: new Date().toISOString(),
    cacheMinutes: 60,
    us: {
      gainers: usGainers,
      nearFair: usNearFair,
    },
    sa: {
      gainers: saGainers,
      nearFair: saNearFair,
    },
  };
}
