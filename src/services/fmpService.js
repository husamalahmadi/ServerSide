// FILE: src/services/fmpService.js
import { getApiUrl } from "../config/env.js";
import { readJsonResponse } from "../utils/apiFetch.js";
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

async function fmpFetch(endpoint, fmpSymbol) {
  const url = fmpApiUrl(endpoint, fmpSymbol);
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  return readJsonResponse(res, `FMP ${endpoint}`);
}

/**
 * Live quote via Express `/api/fmp/quote?symbol=…` (FMP stable quote).
 */
export async function fmpQuote(fmpSymbol) {
  return fmpFetch("quote", fmpSymbol);
}

/**
 * Company profile via Express `/api/fmp/profile?symbol=…`. Never throws — returns null on error.
 */
export async function fmpProfile(fmpSymbol) {
  try {
    return await fmpFetch("profile", fmpSymbol);
  } catch {
    return null;
  }
}

/**
 * Latest annual ratios via Express `/api/fmp/ratios?symbol=…`.
 */
export async function fmpRatios(fmpSymbol) {
  return fmpFetch("ratios", fmpSymbol);
}

/**
 * Income, balance, cash flow, and enterprise values via `/api/fmp/financials?symbol=…`.
 */
export async function fmpFinancials(fmpSymbol) {
  const url = fmpApiUrl("financials", fmpSymbol);
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const txt = await res.text();
  const trimmed = txt.trim();

  if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
    throw new Error(
      `FMP financials: server returned HTML (${res.status}). Check API URL points to your Node host, not static Pages only.`
    );
  }

  let json = {};
  try {
    json = trimmed ? JSON.parse(trimmed) : {};
  } catch {
    throw new Error(`FMP financials: invalid JSON (${res.status})`);
  }

  if (res.status === 422 && json?.retry) {
    throw new FmpIncompleteError(json.error || "Incomplete financial data. Please try again.", {
      issues: json.issues,
    });
  }
  if (!res.ok) throw new Error(json?.error || `FMP financials: HTTP ${res.status}`);
  return json;
}
