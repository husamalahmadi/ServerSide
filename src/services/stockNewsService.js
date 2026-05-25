import { getApiUrl } from "../config/env.js";
import { resolveMarketAndSymbol, fmpSymbolFromResolved } from "../data/stocksCatalog.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

function parsePublishedDate(value) {
  if (!value) return null;
  const d = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Symbol-specific news via Express → FMP stable `news/stock` (API key stays on server).
 */
export async function fetchStockNewsFromFmp({ ticker, market }) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r?.ok) throw new Error("Unknown ticker or market");
  const fmpSym = fmpSymbolFromResolved(r);
  if (!fmpSym) throw new Error("Could not resolve FMP symbol");

  const base = getApiUrl();
  const qs = new URLSearchParams({ symbol: fmpSym });
  const url = `${base}/api/fmp/news/stock?${qs}`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  const rows = await readJsonResponse(res, "Stock news");
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      title: String(row?.title || "").trim(),
      link: String(row?.url || "").trim(),
      source: String(row?.publisher || "").trim(),
      date: parsePublishedDate(row?.publishedDate),
      image: row?.image || null,
      symbol: row?.symbol || fmpSym,
    }))
    .filter((a) => a.title && a.link);
}
