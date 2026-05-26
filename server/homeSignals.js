import { FMP_STABLE_BASE } from "./fmpFetch.js";
import { loadGroupedCatalog } from "./buildScreenerFromFmp.js";
import { computeSaMovers } from "./saMarketDashboard.js";
import { fetchAllBatchQuotes, num } from "./fmpBatchQuotes.js";
import { isUsableScreenerRow } from "../src/domain/screenerMetrics.js";

const NEAR_FAIR_MAX_ABS_DISCOUNT = 14;
const UNUSUAL_MIN_RATIO = 1.35;
const HIST_FETCH_DELAY_MS = 140;
const MAX_HIST_FETCHES_PER_MARKET = 14;
const NEAR_FAIR_QUOTE_CANDIDATES = 48;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

function parseHistoricalRows(payload) {
  let rows = [];
  if (Array.isArray(payload)) rows = payload;
  else if (Array.isArray(payload?.historical)) rows = payload.historical;
  else if (Array.isArray(payload?.data)) rows = payload.data;
  if (!rows.length) return [];
  return rows
    .map((r) => ({
      date: String(r?.date ?? "").slice(0, 10),
      volume: num(r?.volume),
      close: num(r?.close),
    }))
    .filter((r) => r.date)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function volumeVsAverage(sortedDesc) {
  if (sortedDesc.length < 12) return null;
  const latest = sortedDesc[0];
  const vol0 = latest.volume;
  if (vol0 == null || vol0 <= 0) return null;
  const tail = sortedDesc.slice(1, 11);
  const vols = tail.map((r) => r.volume).filter((v) => v != null && v > 0);
  if (vols.length < 5) return null;
  const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
  if (!avg || avg < 1) return null;
  return { ratio: vol0 / avg, latestVolume: vol0, avgVolume: avg };
}

async function fetchHistoricalVolumeInsight(fmpSymbol, apiKey) {
  const url = `${FMP_STABLE_BASE}/historical-price-eod/full?${new URLSearchParams({
    symbol: fmpSymbol,
    apikey: apiKey,
  })}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) return null;
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
  if (data && typeof data === "object" && !Array.isArray(data) && (data["Error Message"] || data.error)) {
    return null;
  }
  const rows = parseHistoricalRows(data);
  return volumeVsAverage(rows);
}

async function buildUnusualVolumeList({ symbolsWithFmp, apiKey }) {
  const list = [];
  let i = 0;
  for (const { symbol, name, price, fmpSymbol } of symbolsWithFmp) {
    if (i >= MAX_HIST_FETCHES_PER_MARKET) break;
    const sym = fmpSymbol || symbol;
    const insight = await fetchHistoricalVolumeInsight(sym, apiKey);
    await sleep(HIST_FETCH_DELAY_MS);
    i += 1;
    if (!insight || insight.ratio < UNUSUAL_MIN_RATIO) continue;
    list.push({
      symbol,
      name: name || symbol,
      price: price ?? null,
      volumeRatio: Math.round(insight.ratio * 100) / 100,
      avgVolume: Math.round(insight.avgVolume),
      latestVolume: Math.round(insight.latestVolume),
    });
  }
  list.sort((a, b) => b.volumeRatio - a.volumeRatio);
  return list.slice(0, 8);
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
  const [gainersArr, mostActivesArr, saMovers, usNearFair, saNearFair] = await Promise.all([
    fetchFmpStableArray("biggest-gainers", {}, apiKey, "biggest-gainers"),
    fetchFmpStableArray("most-actives", {}, apiKey, "most-actives"),
    computeSaMovers(apiKey),
    buildNearFairList(usItems, "us", apiKey, 8),
    buildNearFairList(saItems, "sa", apiKey, 8),
  ]);

  const usGainers = gainersArr.map(mapUsMover).filter((r) => r.symbol);
  const topUsGainers = [...usGainers]
    .sort((a, b) => (b.changesPercentage ?? -Infinity) - (a.changesPercentage ?? -Infinity))
    .slice(0, 8);

  const mostActive = mostActivesArr.map(mapUsMover).filter((r) => r.symbol && r.volume > 0);
  const seen = new Set();
  const usHistCandidates = [];
  for (const row of mostActive) {
    if (seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    usHistCandidates.push({
      symbol: row.symbol,
      name: row.name,
      price: row.price,
      fmpSymbol: row.symbol,
    });
    if (usHistCandidates.length >= MAX_HIST_FETCHES_PER_MARKET) break;
  }

  const saWithChange = saMovers.filter((m) => m.changesPercentage != null);
  const topSaGainers = [...saWithChange]
    .sort((a, b) => b.changesPercentage - a.changesPercentage)
    .slice(0, 8)
    .map(({ symbol, name, price, changesPercentage }) => ({
      symbol,
      name,
      price: price > 0 ? price : null,
      changesPercentage,
    }));

  const saVolSorted = [...saMovers]
    .filter((m) => Number.isFinite(m.volume) && m.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, MAX_HIST_FETCHES_PER_MARKET)
    .map((m) => ({
      symbol: m.symbol,
      name: m.name,
      price: m.price > 0 ? m.price : null,
      fmpSymbol: `${String(m.symbol).trim()}.SR`,
    }));

  const [usUnusual, saUnusual, usGainersEnriched, saGainersEnriched] = await Promise.all([
    buildUnusualVolumeList({ symbolsWithFmp: usHistCandidates, apiKey }),
    buildUnusualVolumeList({ symbolsWithFmp: saVolSorted, apiKey }),
    enrichRowsWithQuotes(topUsGainers, "us", apiKey),
    enrichRowsWithQuotes(topSaGainers, "sa", apiKey),
  ]);

  const [usUnusualFinal, saUnusualFinal] = await Promise.all([
    enrichRowsWithQuotes(usUnusual, "us", apiKey),
    enrichRowsWithQuotes(saUnusual, "sa", apiKey),
  ]);

  return {
    updatedAt: new Date().toISOString(),
    cacheMinutes: 60,
    us: {
      gainers: usGainersEnriched,
      unusualVolume: usUnusualFinal,
      nearFair: usNearFair,
    },
    sa: {
      gainers: saGainersEnriched,
      unusualVolume: saUnusualFinal,
      nearFair: saNearFair,
    },
  };
}
