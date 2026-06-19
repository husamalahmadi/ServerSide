import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

/**
 * Yearly EV fair value + monthly price history for the DCF hero chart.
 */
export async function fetchFairValueChart(fmpSymbol) {
  const sym = String(fmpSymbol || "").trim();
  if (!sym) throw new Error("FMP symbol required");
  const url = `${getApiUrl()}/api/fmp/fair-value-chart?${new URLSearchParams({ symbol: sym })}`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "Fair value chart");
}
