import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

/**
 * DCF fair value via Express (FMP stable discounted-cash-flow).
 * Guests receive `locked: true` without the DCF figure; signed-in users get full data.
 */
export async function fetchStockDcf(fmpSymbol, market) {
  const sym = String(fmpSymbol || "").trim();
  if (!sym) throw new Error("FMP symbol required");
  const params = new URLSearchParams({ symbol: sym });
  if (market) params.set("market", String(market));
  const url = `${getApiUrl()}/api/fmp/dcf?${params}`;
  const res = await fetchWithRetry(url, {
    cache: "no-store",
    credentials: "include",
  });
  return readJsonResponse(res, "DCF fair value");
}
