import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

/**
 * Key metrics (valuation, returns, health) via Express (FMP stable key-metrics).
 * Returns an array of fiscal-year rows, newest first.
 */
export async function fetchKeyMetrics(fmpSymbol, limit = 5) {
  const sym = String(fmpSymbol || "").trim();
  if (!sym) throw new Error("FMP symbol required");
  const params = new URLSearchParams({ symbol: sym, limit: String(limit) });
  const url = `${getApiUrl()}/api/fmp/key-metrics?${params}`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "Key metrics");
}
