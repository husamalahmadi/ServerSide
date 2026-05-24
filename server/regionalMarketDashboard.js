import { loadGroupedCatalog } from "./buildScreenerFromFmp.js";
import { FMP_STABLE_BASE } from "./fmpFetch.js";
import { isUsableScreenerRow } from "../src/domain/screenerMetrics.js";

const QUOTE_CHUNK = 40;
const MAX_QUOTES = {
  sa: 500,
  jp: Number(process.env.JP_MARKET_QUOTE_MAX || 600),
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function tickerDigits(ticker) {
  const m = String(ticker || "").match(/(\d+)/);
  return m ? m[1] : "";
}

/** Tokyo has one catalog sector; bucket by ticker prefix for sector/industry charts. */
function bucketForEntry(market, entry, kind) {
  if (market === "sa") return entry.sector || "Other";
  const digits = tickerDigits(entry.ticker);
  if (!digits) return "Other";
  if (kind === "sector") return `${digits[0]}xxx`;
  const two = digits.length >= 2 ? digits.slice(0, 2) : digits;
  return `${two}xx`;
}

async function fetchBatchQuoteChunk(symbols, apiKey) {
  if (!symbols.length) return [];
  const url = `${FMP_STABLE_BASE}/batch-quote?${new URLSearchParams({
    symbols: symbols.join(","),
    apikey: apiKey,
  })}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`FMP batch-quote HTTP ${r.status}`);
  let arr;
  try {
    arr = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("FMP batch-quote: invalid JSON");
  }
  if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
    throw new Error(String(arr["Error Message"] || arr.error));
  }
  if (!Array.isArray(arr)) throw new Error("FMP batch-quote: expected array");
  return arr;
}

async function fetchAllQuotes(fmpSymbols, apiKey) {
  const unique = [...new Set(fmpSymbols.map((s) => String(s).trim()).filter(Boolean))];
  const rows = [];
  for (let i = 0; i < unique.length; i += QUOTE_CHUNK) {
    const chunk = unique.slice(i, i + QUOTE_CHUNK);
    const part = await fetchBatchQuoteChunk(chunk, apiKey);
    rows.push(...part);
    if (i + QUOTE_CHUNK < unique.length) await sleep(120);
  }
  return rows;
}

function selectEntries(market, entries, screenerItems) {
  const max = MAX_QUOTES[market] ?? 500;
  if (entries.length <= max) return entries;
  const priority = new Set(
    (screenerItems || [])
      .filter(isUsableScreenerRow)
      .map((r) => String(r.ticker).toUpperCase())
  );
  const prioritized = entries.filter((e) => priority.has(String(e.ticker).toUpperCase()));
  const rest = entries.filter((e) => !priority.has(String(e.ticker).toUpperCase()));
  return [...prioritized, ...rest].slice(0, max);
}

function aggregateGroups(market, movers, kind, { minCount = 1 }) {
  const byKey = new Map();
  for (const row of movers) {
    const key = bucketForEntry(market, row._entry, kind);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  const out = [];
  for (const [label, list] of byKey.entries()) {
    if (list.length < minCount) continue;
    const changes = list.map((r) => r.changesPercentage).filter((n) => Number.isFinite(n));
    if (!changes.length) continue;
    const averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    out.push({
      sector: label,
      industry: label,
      averageChange,
      count: list.length,
    });
  }
  return out.sort((a, b) => b.averageChange - a.averageChange);
}

/**
 * @param {"sa"|"jp"} market
 * @param {{ apiKey: string, screenerStore?: { read: (m: string) => { record?: { items?: unknown[] } } | null } }} opts
 */
export async function buildRegionalMarketDashboard(market, opts) {
  const { apiKey, screenerStore } = opts;
  if (market !== "sa" && market !== "jp") throw new Error(`Unsupported market: ${market}`);

  const entries = loadGroupedCatalog(market);
  const screenerItems = screenerStore?.read(market)?.record?.items || [];
  const targets = selectEntries(market, entries, screenerItems);

  const byFmp = new Map(entries.map((e) => [e.fmpSymbol.toUpperCase(), e]));
  const quoteRows = await fetchAllQuotes(
    targets.map((e) => e.fmpSymbol),
    apiKey
  );

  const movers = [];
  for (const q of quoteRows) {
    const sym = String(q?.symbol ?? "").toUpperCase();
    const entry = byFmp.get(sym);
    if (!entry) continue;
    const price = num(q?.price);
    const changesPercentage = num(q?.changesPercentage ?? q?.changePercent);
    const volume = num(q?.volume);
    if (price == null && changesPercentage == null) continue;
    movers.push({
      symbol: entry.ticker,
      name: String(q?.name || entry.name || entry.ticker),
      price: price ?? 0,
      change: num(q?.change) ?? 0,
      changesPercentage: changesPercentage ?? 0,
      volume: volume ?? 0,
      exchange: q?.exchange ?? (market === "sa" ? "TADAWUL" : "TSE"),
      _entry: entry,
    });
  }

  const withChange = movers.filter((m) => Number.isFinite(m.changesPercentage));
  const gainers = [...withChange].sort((a, b) => b.changesPercentage - a.changesPercentage);
  const losers = [...withChange].sort((a, b) => a.changesPercentage - b.changesPercentage);
  const mostActives = [...movers]
    .filter((m) => Number.isFinite(m.volume) && m.volume > 0)
    .sort((a, b) => b.volume - a.volume);

  const sectorMin = market === "jp" ? 8 : 1;
  const industryMin = market === "jp" ? 5 : 1;
  const sectorRows = aggregateGroups(market, movers, "sector", { minCount: sectorMin });
  const industryRows = aggregateGroups(market, movers, "industry", { minCount: industryMin });

  const sectors =
    market === "sa"
      ? sectorRows.map((r) => ({ sector: r.sector, exchange: "TADAWUL", averageChange: r.averageChange }))
      : sectorRows.map((r) => ({ sector: r.sector, exchange: "TSE", averageChange: r.averageChange }));

  const industries =
    market === "sa"
      ? industryRows.map((r) => ({ industry: r.industry, exchange: "TADAWUL", averageChange: r.averageChange }))
      : industryRows.map((r) => ({ industry: r.industry, exchange: "TSE", averageChange: r.averageChange }));

  const strip = (rows) =>
    rows.slice(0, 50).map(({ symbol, name, price, change, changesPercentage, exchange }) => ({
      symbol,
      name,
      price,
      change,
      changesPercentage,
      exchange,
    }));

  return {
    market,
    asOf: new Date().toISOString(),
    catalogCount: entries.length,
    quoteCount: movers.length,
    sampledCount: targets.length,
    sectors,
    industries,
    gainers: strip(gainers),
    losers: strip(losers),
    mostActives: strip(mostActives),
  };
}
