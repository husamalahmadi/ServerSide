import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FMP_STABLE_BASE, fmpApiKey } from "./fmpFetch.js";
import { scoreInsiderSignal, tradeKey } from "../shared/insiderSignal.js";

const DAY = 86_400_000;
export const INSIDER_SIGNAL_TTL_MS = 12 * 60 * 60_000;
const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), "data", "cache", "insider-signal");
const memory = new Map();

const US_ONLY_MESSAGE = "Insider filings are available for US-listed stocks only.";

export function normalizeInsiderSymbol(raw) {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

/** SEC Form 4 coverage is US listings. Suffixes such as .SR, .T and .L are other markets. */
export function isNonUsSymbol(symbol) {
  if (!symbol) return false;
  if (/^\d+$/.test(symbol)) return true;
  return /\.(SR|SA|T|HK|L|TO|PA|DE|AX|KS|TW|TWO|NS|BO)$/i.test(symbol);
}

export function isPlausibleUsSymbol(symbol) {
  return /^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol) && !isNonUsSymbol(symbol);
}

function isoDaysAgo(now, n) {
  return new Date(now.getTime() - n * DAY).toISOString().slice(0, 10);
}

function cacheFile(symbol) {
  return join(CACHE_DIR, `${symbol.replace(/[^A-Z0-9.-]/g, "_")}.json`);
}

function readCache(symbol) {
  const mem = memory.get(symbol);
  if (mem && Date.now() - mem.cachedAt < INSIDER_SIGNAL_TTL_MS) return mem.payload;
  if (!existsSync(cacheFile(symbol))) return null;
  try {
    const raw = JSON.parse(readFileSync(cacheFile(symbol), "utf8"));
    if (!raw?.payload || !raw?.cachedAt) return null;
    if (Date.now() - raw.cachedAt > INSIDER_SIGNAL_TTL_MS) return null;
    memory.set(symbol, raw);
    return raw.payload;
  } catch {
    return null;
  }
}

function writeCache(symbol, payload) {
  const entry = { cachedAt: Date.now(), payload };
  memory.set(symbol, entry);
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile(symbol), JSON.stringify(entry));
}

export class InsiderSignalError extends Error {
  constructor(message, status = 502, code = "fmp") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function fmpGet(path, params, key) {
  const url = `${FMP_STABLE_BASE}/${path}?${new URLSearchParams({ ...params, apikey: key })}`;
  const res = await fetch(url);
  const text = await res.text();
  if (res.status === 429) {
    throw new InsiderSignalError(
      "FMP rate limit reached (HTTP 429). Insider data for this symbol is temporarily unavailable. Try again later.",
      429,
      "rate_limit",
    );
  }
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new InsiderSignalError(`FMP ${path}: invalid JSON (HTTP ${res.status})`);
    }
  }
  if (data && typeof data === "object" && !Array.isArray(data) && (data["Error Message"] || data.error)) {
    const msg = String(data["Error Message"] || data.error);
    const limited = /limit|premium|restricted|upgrade/i.test(msg);
    throw new InsiderSignalError(msg, limited ? 429 : 502, limited ? "plan_limit" : "fmp");
  }
  if (!res.ok) {
    throw new InsiderSignalError(`FMP ${path} HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  }
  return Array.isArray(data) ? data : [];
}

function mapTrade(row) {
  const date = String(row?.transactionDate || row?.filingDate || "").slice(0, 10);
  return {
    symbol: String(row?.symbol || ""),
    filingDate: row?.filingDate ? String(row.filingDate).slice(0, 10) : undefined,
    transactionDate: date,
    reportingCik: row?.reportingCik ? String(row.reportingCik) : undefined,
    reportingName: String(row?.reportingName || "Unknown insider"),
    typeOfOwner: row?.typeOfOwner ? String(row.typeOfOwner) : undefined,
    transactionType: String(row?.transactionType || ""),
    securitiesTransacted: Number(row?.securitiesTransacted) || 0,
    securitiesOwned: Number(row?.securitiesOwned) || 0,
    price: Number(row?.price) || 0,
    url: row?.url ? String(row.url) : undefined,
  };
}

function dedupe(trades) {
  const seen = new Set();
  const out = [];
  for (const trade of trades) {
    const key = tradeKey(trade);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trade);
  }
  return out;
}

async function fetchTradePages(symbol, key, transactionType, maxPages, cutoff) {
  const rows = [];
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await fmpGet(
      "insider-trading/search",
      { symbol, transactionType, page: String(page), limit: "100" },
      key,
    );
    rows.push(...batch);
    if (batch.length < 100) break;
    const oldest = String(batch[batch.length - 1]?.transactionDate || "").slice(0, 10);
    if (oldest && oldest < cutoff) break;
  }
  const prefix = transactionType.slice(0, 1);
  return dedupe(rows.map(mapTrade).filter((t) => t.transactionDate && t.transactionType.startsWith(prefix)));
}

function mapQuarter(row) {
  return {
    year: Number(row?.year) || 0,
    quarter: Number(row?.quarter) || 0,
    totalPurchases: Number(row?.totalPurchases) || 0,
    totalSales: Number(row?.totalSales) || 0,
    totalAcquired: Number(row?.totalAcquired) || 0,
    totalDisposed: Number(row?.totalDisposed) || 0,
  };
}

/**
 * One symbol, at most 9 FMP calls (stats + 3 purchase pages + 3 sale pages + 1 award page + prices).
 * Successful payloads are cached for 12 hours. Errors are not cached.
 */
export async function getInsiderSignal(rawSymbol, now = new Date()) {
  const symbol = normalizeInsiderSymbol(rawSymbol);
  if (!symbol) {
    throw new InsiderSignalError("Enter a US ticker symbol.", 400, "invalid");
  }
  if (isNonUsSymbol(symbol)) {
    return {
      status: "us-only",
      symbol,
      message: US_ONLY_MESSAGE,
      cached: false,
    };
  }
  if (!isPlausibleUsSymbol(symbol)) {
    throw new InsiderSignalError(`"${symbol}" is not a recognized US ticker format.`, 400, "invalid");
  }

  const cached = readCache(symbol);
  if (cached) return { ...cached, cached: true };

  const key = fmpApiKey();
  if (!key) {
    throw new InsiderSignalError("FMP_API_KEY is not configured on the server.", 503, "config");
  }

  const cutoff = isoDaysAgo(now, 365);
  const from = isoDaysAgo(now, 470);
  const [stats, buys, sells, awards, priceRows] = await Promise.all([
    fmpGet("insider-trading/statistics", { symbol }, key),
    fetchTradePages(symbol, key, "P-Purchase", 3, cutoff),
    fetchTradePages(symbol, key, "S-Sale", 3, cutoff),
    fetchTradePages(symbol, key, "A-Award", 1, cutoff),
    fmpGet("historical-price-eod/light", { symbol, from }, key),
  ]);

  const quarters = stats.map(mapQuarter).filter((q) => q.year && q.quarter);
  const prices = priceRows
    .map((row) => ({ date: String(row?.date || "").slice(0, 10), price: Number(row?.price) }))
    .filter((p) => p.date && Number.isFinite(p.price))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (!quarters.length && !buys.length && !sells.length && !awards.length && !prices.length) {
    const empty = {
      status: "not-found",
      symbol,
      message: `No insider filings or price history for ${symbol}. Check the ticker — this screener covers US-listed stocks only.`,
    };
    writeCache(symbol, empty);
    return { ...empty, cached: false };
  }

  const scored = scoreInsiderSignal({ buys, sells, awards, quarters, prices, now });
  const payload = {
    status: "ok",
    symbol,
    asOf: now.toISOString(),
    score: scored.score,
    verdict: scored.verdict,
    summary: scored.summary,
    checks: scored.checks,
    flags: scored.flags,
    routineBuyKeys: scored.routineBuyKeys,
    quarters,
    trades: { buys, sells, awards },
    prices,
  };
  writeCache(symbol, payload);
  return { ...payload, cached: false };
}
