import { FMP_STABLE_BASE } from "./fmpFetch.js";
import { computeSaMovers } from "./saMarketDashboard.js";
import { isUsableScreenerRow } from "../src/domain/screenerMetrics.js";

const NEAR_FAIR_MAX_ABS_DISCOUNT = 14;
const UNUSUAL_MIN_RATIO = 1.35;
const HIST_FETCH_DELAY_MS = 140;
const MAX_HIST_FETCHES_PER_MARKET = 14;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
  return {
    symbol: String(row?.symbol ?? "").trim().toUpperCase(),
    name: String(row?.name ?? "").trim(),
    price: num(row?.price),
    changesPercentage: num(row?.changesPercentage ?? row?.changePercent),
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

/** Latest session volume vs trailing average (excludes latest bar from average). */
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

async function buildUnusualVolumeList({ symbolsWithFmp, apiKey, label }) {
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

function pickNearFair(items, limit = 8) {
  const rows = (items || [])
    .filter(isUsableScreenerRow)
    .map((r) => ({
      ticker: r.ticker,
      name: r.name || r.ticker,
      market: r.market,
      sector: r.sector || "",
      discountPct: num(r.discountPct),
      fairValue: num(r.fairValue),
      priceApprox: num(r.priceApprox),
    }))
    .filter(
      (r) =>
        r.discountPct != null &&
        Math.abs(r.discountPct) <= NEAR_FAIR_MAX_ABS_DISCOUNT &&
        r.fairValue != null &&
        r.priceApprox != null
    )
    .sort((a, b) => Math.abs(a.discountPct) - Math.abs(b.discountPct));
  return rows.slice(0, limit);
}

/**
 * @param {string} apiKey
 * @param {{ usItems: object[], saItems: object[] }} screenerRows — raw per-market screener rows from disk
 */
export async function buildHomeSignals(apiKey, { usItems = [], saItems = [] } = {}) {
  const [gainersArr, mostActivesArr, saMovers] = await Promise.all([
    fetchFmpStableArray("biggest-gainers", {}, apiKey, "biggest-gainers"),
    fetchFmpStableArray("most-actives", {}, apiKey, "most-actives"),
    computeSaMovers(apiKey),
  ]);

  const usGainers = gainersArr.map(mapUsMover).filter((r) => r.symbol);
  const topUsGainers = [...usGainers].sort((a, b) => (b.changesPercentage || 0) - (a.changesPercentage || 0)).slice(0, 8);

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

  const saWithChange = saMovers.filter((m) => Number.isFinite(m.changesPercentage));
  const topSaGainers = [...saWithChange]
    .sort((a, b) => b.changesPercentage - a.changesPercentage)
    .slice(0, 8)
    .map(({ symbol, name, price, changesPercentage }) => ({
      symbol,
      name,
      price,
      changesPercentage,
    }));

  const saVolSorted = [...saMovers]
    .filter((m) => Number.isFinite(m.volume) && m.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, MAX_HIST_FETCHES_PER_MARKET)
    .map((m) => ({
      symbol: m.symbol,
      name: m.name,
      price: m.price,
      fmpSymbol: `${String(m.symbol).trim()}.SR`,
    }));

  const [usUnusual, saUnusual] = await Promise.all([
    buildUnusualVolumeList({ symbolsWithFmp: usHistCandidates, apiKey, label: "us" }),
    buildUnusualVolumeList({ symbolsWithFmp: saVolSorted, apiKey, label: "sa" }),
  ]);

  return {
    updatedAt: new Date().toISOString(),
    cacheMinutes: 12,
    us: {
      gainers: topUsGainers.map(({ symbol, name, price, changesPercentage }) => ({
        symbol,
        name,
        price,
        changesPercentage,
      })),
      unusualVolume: usUnusual,
      nearFair: pickNearFair(usItems, 8),
    },
    sa: {
      gainers: topSaGainers,
      unusualVolume: saUnusual,
      nearFair: pickNearFair(saItems, 8),
    },
  };
}
