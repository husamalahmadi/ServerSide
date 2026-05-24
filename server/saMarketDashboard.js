import { loadGroupedCatalog } from "./buildScreenerFromFmp.js";
import { FMP_STABLE_BASE } from "./fmpFetch.js";

const QUOTE_CHUNK = 40;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

function stripMovers(rows) {
  return rows.slice(0, 50).map(({ symbol, name, price }) => ({
    symbol,
    name,
    price,
  }));
}

/** TASI gainers, losers, and most active from catalog + FMP batch quotes. */
export async function buildSaMarketDashboard(apiKey) {
  const entries = loadGroupedCatalog("sa");
  const byFmp = new Map(entries.map((e) => [e.fmpSymbol.toUpperCase(), e]));
  const quoteRows = await fetchAllQuotes(
    entries.map((e) => e.fmpSymbol),
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
      changesPercentage: changesPercentage ?? 0,
      volume: volume ?? 0,
    });
  }

  const withChange = movers.filter((m) => Number.isFinite(m.changesPercentage));
  const gainers = [...withChange].sort((a, b) => b.changesPercentage - a.changesPercentage);
  const losers = [...withChange].sort((a, b) => a.changesPercentage - b.changesPercentage);
  const mostActives = [...movers]
    .filter((m) => Number.isFinite(m.volume) && m.volume > 0)
    .sort((a, b) => b.volume - a.volume);

  return {
    market: "sa",
    gainers: stripMovers(gainers),
    losers: stripMovers(losers),
    mostActives: stripMovers(mostActives),
  };
}
