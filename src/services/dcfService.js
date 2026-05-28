import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

/**
 * DCF fair value via Express (FMP stable discounted-cash-flow).
 * Guests receive `locked: true` without the DCF figure; signed-in users get full data.
 */
export async function fetchStockDcf(fmpSymbol) {
  const sym = String(fmpSymbol || "").trim();
  if (!sym) throw new Error("FMP symbol required");
  const url = `${getApiUrl()}/api/fmp/dcf?${new URLSearchParams({ symbol: sym })}`;
  const res = await fetchWithRetry(url, {
    cache: "no-store",
    credentials: "include",
  });
  return readJsonResponse(res, "DCF fair value");
}
