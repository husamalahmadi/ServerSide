// FILE: src/services/fmpService.js
import { getApiUrl } from "../config/env.js";
import { FmpIncompleteError } from "./fmpErrors.js";

/**
 * Query-string symbol avoids broken paths for Tokyo tickers (e.g. /quote/7203.T) on some proxies.
 */
function fmpApiUrl(endpoint, fmpSymbol) {
  const sym = String(fmpSymbol || "").trim();
  if (!sym) throw new Error("FMP symbol required");
  const base = `${getApiUrl()}/api/fmp/${endpoint}`;
  return `${base}?${new URLSearchParams({ symbol: sym })}`;
}

/**
 * Live quote via Express `/api/fmp/quote?symbol=…` (FMP stable quote).
 * @param {string} fmpSymbol  e.g. "AAPL" or "1150.SR" or "7203.T"
 * @returns {Promise<{ price?: number, currency?: string }>}
 */
export async function fmpQuote(fmpSymbol) {
  const url = fmpApiUrl("quote", fmpSymbol);
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

/**
 * Company profile via Express `/api/fmp/profile?symbol=…` (mapped for Stock.jsx).
 * Never throws — returns null on error.
 * @param {string} fmpSymbol  e.g. "AAPL" or "1150.SR" or "7203.T"
 */
export async function fmpProfile(fmpSymbol) {
  try {
    const url = fmpApiUrl("profile", fmpSymbol);
    const res = await fetch(url, { cache: "no-store", credentials: "include" });
    const json = await res.json().catch(() => null);
    if (!res.ok) return null;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

/**
 * Latest annual ratios via Express `/api/fmp/ratios?symbol=…` (FMP stable ratios).
 * @returns {Promise<{ priceToEarningsRatio?: number|null, priceToSalesRatio?: number|null }>}
 */
export async function fmpRatios(fmpSymbol) {
  const url = fmpApiUrl("ratios", fmpSymbol);
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

/**
 * Income, balance, cash flow, and enterprise values via `/api/fmp/financials?symbol=…`.
 * @returns {Promise<{ income: object[], balance: object[], cash: object[], enterpriseValues: object[] }>}
 */
export async function fmpFinancials(fmpSymbol) {
  const url = fmpApiUrl("financials", fmpSymbol);
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (res.status === 422 && json?.retry) {
    throw new FmpIncompleteError(json.error || "Incomplete financial data. Please try again.", {
      issues: json.issues,
    });
  }
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}
