import { FMP_STABLE_BASE } from "./fmpFetch.js";
import { loadGroupedCatalog } from "./buildScreenerFromFmp.js";
import { fetchAllBatchQuotes, num } from "./fmpBatchQuotes.js";
import { readMarketUniverseDisk, writeMarketUniverseDisk } from "./marketUniverseCache.js";

function catalogIndustryMap(market) {
  const entries = loadGroupedCatalog(market);
  const byTicker = new Map();
  for (const e of entries) {
    const key = market === "sa" ? String(e.ticker) : String(e.ticker).toUpperCase();
    if (!byTicker.has(key)) {
      byTicker.set(key, { name: e.name, industry: e.sector || "" });
    }
  }
  return byTicker;
}

async function fetchSp500Constituents(apiKey) {
  const url = `${FMP_STABLE_BASE}/sp500-constituent?${new URLSearchParams({ apikey: apiKey })}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`FMP sp500-constituent HTTP ${r.status}`);
  let arr;
  try {
    arr = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("FMP sp500-constituent: invalid JSON");
  }
  if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
    throw new Error(String(arr["Error Message"] || arr.error));
  }
  if (!Array.isArray(arr)) throw new Error("FMP sp500-constituent: expected array");
  return arr;
}

/**
 * @param {{ symbol: string, fmpSymbol: string, name?: string, industry?: string }[]} items
 */
function mergeQuotes(items, quoteRows) {
  const quoteByFmp = new Map();
  for (const q of quoteRows) {
    const sym = String(q?.symbol ?? "").toUpperCase();
    if (sym) quoteByFmp.set(sym, q);
  }

  const stocks = [];
  for (const row of items) {
    const symbol = String(row.symbol ?? "").trim();
    const fmpSym = String(row.fmpSymbol ?? symbol).trim().toUpperCase();
    if (!symbol) continue;
    const q = quoteByFmp.get(fmpSym);
    const price = num(q?.price);
    const changesPercentage = num(q?.changesPercentage ?? q?.changePercent);
    stocks.push({
      symbol,
      name: String(q?.name || row.name || symbol).trim(),
      industry: String(row.industry || "").trim(),
      price: price ?? null,
      changesPercentage,
    });
  }

  stocks.sort((a, b) => a.symbol.localeCompare(b.symbol));
  const industries = [...new Set(stocks.map((s) => s.industry).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
  return { stocks, industries };
}

/** S&P 500 constituents + catalog industry + batch quotes. */
export async function buildUsMarketUniverse(apiKey) {
  const catalogByTicker = catalogIndustryMap("us");
  const constituents = await fetchSp500Constituents(apiKey);
  const items = constituents
    .map((r) => {
      const symbol = String(r?.symbol ?? "").trim().toUpperCase();
      if (!symbol) return null;
      const cat = catalogByTicker.get(symbol);
      return {
        symbol,
        fmpSymbol: symbol,
        name: String(r?.name || cat?.name || symbol),
        industry: String(cat?.industry || r?.sector || r?.industry || r?.subSector || ""),
      };
    })
    .filter(Boolean);
  const quoteRows = await fetchAllBatchQuotes(
    items.map((i) => i.fmpSymbol),
    apiKey
  );
  const { stocks, industries } = mergeQuotes(items, quoteRows);
  return {
    market: "us",
    indexLabel: "S&P 500",
    updatedAt: new Date().toISOString(),
    cacheMinutes: 20,
    count: stocks.length,
    industryCount: industries.length,
    industries,
    stocks,
  };
}

/** Full TASI catalog + batch quotes. */
export async function buildSaMarketUniverse(apiKey) {
  const entries = loadGroupedCatalog("sa");
  const items = entries.map((e) => ({
    symbol: e.ticker,
    fmpSymbol: e.fmpSymbol,
    name: e.name,
    industry: e.sector || "",
  }));
  const quoteRows = await fetchAllBatchQuotes(
    items.map((i) => i.fmpSymbol),
    apiKey
  );
  const { stocks, industries } = mergeQuotes(items, quoteRows);
  return {
    market: "sa",
    indexLabel: "TASI",
    updatedAt: new Date().toISOString(),
    cacheMinutes: 20,
    count: stocks.length,
    industryCount: industries.length,
    industries,
    stocks,
  };
}

export async function getMarketUniverse(market, apiKey, buildFn) {
  const disk = readMarketUniverseDisk(market);
  if (disk) return disk;
  const data = await buildFn(apiKey);
  writeMarketUniverseDisk(market, data);
  return data;
}
