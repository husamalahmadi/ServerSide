// FILE: src/services/fmpService.js
import { getApiUrl } from "../config/env.js";

/**
 * Live quote via Express `/api/fmp/quote/:symbol` (FMP stable quote).
 * @param {string} fmpSymbol  e.g. "AAPL" or "1150.SR"
 * @returns {Promise<{ price?: number, currency?: string }>}
 */
export async function fmpQuote(fmpSymbol) {
  const url = `${getApiUrl()}/api/fmp/quote/${encodeURIComponent(fmpSymbol)}`;
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

/**
 * Company profile via Express `/api/fmp/profile/:symbol` (mapped for Stock.jsx).
 * Never throws — returns null on error.
 * @param {string} fmpSymbol  e.g. "AAPL" or "1150.SR"
 */
export async function fmpProfile(fmpSymbol) {
  try {
    const url = `${getApiUrl()}/api/fmp/profile/${encodeURIComponent(fmpSymbol)}`;
    const res = await fetch(url, { cache: "no-store", credentials: "include" });
    const json = await res.json().catch(() => null);
    if (!res.ok) return null;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

/**
 * Latest annual ratios via Express `/api/fmp/ratios/:symbol` (FMP stable ratios).
 * @returns {Promise<{ priceToEarningsRatio?: number|null, priceToSalesRatio?: number|null }>}
 */
export async function fmpRatios(fmpSymbol) {
  const url = `${getApiUrl()}/api/fmp/ratios/${encodeURIComponent(fmpSymbol)}`;
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}
