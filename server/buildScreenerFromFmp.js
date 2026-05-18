import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { screenerRowFromCompany, isUsableScreenerRow } from "../src/domain/screenerMetrics.js";
import { fetchFmpFinancialsBundle } from "./fmpFetch.js";
import { validateFmpFinancialsBundle } from "./fmpFinancialsStore.js";
import { SCREENER_MARKETS } from "./screenerStore.js";

const serverDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(serverDir, "..");

const GROUPED_PATH = {
  us: join(repoRoot, "public", "data", "sp500_grouped_by_industry.json"),
  sa: join(repoRoot, "public", "data", "tasi_grouped_by_industry.json"),
  jp: join(repoRoot, "public", "data", "tokyo_stock_exchange.json"),
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fmpSymbolFor(market, ticker) {
  if (market === "us") return ticker.toUpperCase();
  if (market === "sa") return `${ticker}.SR`;
  // Tokyo tickers in the catalog already include the ".T" suffix.
  const up = ticker.toUpperCase();
  return up.endsWith(".T") ? up : `${up}.T`;
}

function tickerFor(market, raw) {
  if (market === "us" || market === "jp") return raw.toUpperCase();
  return raw;
}

export function loadGroupedCatalog(market) {
  const path = GROUPED_PATH[market];
  if (!existsSync(path)) throw new Error(`Grouped catalog not found: ${path}`);
  const grouped = JSON.parse(readFileSync(path, "utf8"));
  const entries = [];
  for (const [sector, list] of Object.entries(grouped || {})) {
    if (!Array.isArray(list)) continue;
    for (const it of list) {
      const raw = String(it?.Ticker ?? it?.ticker ?? "").trim();
      if (!raw) continue;
      const ticker = tickerFor(market, raw);
      const name = String(it?.Company ?? it?.company ?? ticker).trim();
      const fmpSymbol = fmpSymbolFor(market, raw);
      entries.push({ ticker, name, sector, fmpSymbol });
    }
  }
  return entries;
}

function companyFromBundle(entry, bundle) {
  return {
    ticker: entry.ticker,
    company_name: bundle.companyName || entry.name,
    company: entry.name,
    industry: entry.sector,
    data: {
      enterprise_values: bundle.enterpriseValues || [],
      balance_sheet: bundle.balance || [],
      income_statement: bundle.income || [],
    },
  };
}

/**
 * @param {"us"|"sa"|"jp"} market
 * @param {{ apiKey: string, financialsStore?: object, delayMs?: number, maxTickers?: number }} opts
 */
export async function buildScreenerMarket(market, opts) {
  const { apiKey, financialsStore, delayMs = 350, maxTickers } = opts;
  const entries = loadGroupedCatalog(market);
  const slice = maxTickers ? entries.slice(0, maxTickers) : entries;
  const items = [];
  let skipped = 0;
  let fetched = 0;
  let fromDisk = 0;

  for (let i = 0; i < slice.length; i++) {
    const entry = slice[i];
    let bundle = null;

    if (financialsStore) {
      const hit = financialsStore.readRecord(entry.fmpSymbol);
      if (hit?.record && !financialsStore.isExpired(hit.record)) {
        bundle = {
          symbol: entry.fmpSymbol,
          companyName: hit.record.companyName,
          income: hit.record.income,
          balance: hit.record.balance,
          cash: hit.record.cash,
          enterpriseValues: hit.record.enterpriseValues,
          fetchErrors: [],
        };
        fromDisk += 1;
      }
    }

    if (!bundle) {
      try {
        bundle = await fetchFmpFinancialsBundle(entry.fmpSymbol, apiKey);
        fetched += 1;
        if (bundle.fetchErrors?.length) {
          skipped += 1;
          if (delayMs > 0) await sleep(delayMs);
          continue;
        }
        const validation = validateFmpFinancialsBundle(bundle);
        if (!validation.ok) {
          skipped += 1;
          if (delayMs > 0) await sleep(delayMs);
          continue;
        }
        if (financialsStore) {
          financialsStore.writeRecord(entry.fmpSymbol, bundle.companyName || entry.name, bundle);
        }
      } catch {
        skipped += 1;
        if (delayMs > 0) await sleep(delayMs);
        continue;
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    const row = screenerRowFromCompany(companyFromBundle(entry, bundle), market, entry.sector);
    if (isUsableScreenerRow(row)) {
      items.push(row);
    } else {
      skipped += 1;
    }

    if ((i + 1) % 25 === 0) {
      console.log(`[screener/build] ${market} ${i + 1}/${slice.length} rows=${items.length} skipped=${skipped}`);
    }
  }

  return {
    items,
    stats: {
      catalog: slice.length,
      rows: items.length,
      skipped,
      fetched,
      fromDisk,
    },
  };
}

function marketBuildUsable(items, catalogSize) {
  if (!items?.length) return false;
  const usable = items.filter(isUsableScreenerRow).length;
  if (usable / items.length < 0.5) return false;
  if (catalogSize > 0 && items.length / catalogSize < 0.1) return false;
  return true;
}

export async function buildAllScreeners({ apiKey, financialsStore, screenerStore, delayMs }) {
  const results = {};
  for (const market of SCREENER_MARKETS) {
    const built = await buildScreenerMarket(market, { apiKey, financialsStore, delayMs });
    let saved = null;
    if (marketBuildUsable(built.items, built.stats.catalog)) {
      saved = screenerStore.write(market, built.items, { buildStats: built.stats });
      console.log(
        `[screener/build] wrote ${market.toUpperCase()} ${saved.filePath} (${built.items.length} items)`
      );
    } else {
      console.warn(
        `[screener/build] skip ${market.toUpperCase()} disk write — only ${built.items.length}/${built.stats.catalog} usable rows`
      );
    }
    results[market] = { ...built, saved };
  }
  return results;
}
