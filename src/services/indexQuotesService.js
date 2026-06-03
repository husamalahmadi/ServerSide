import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

/**
 * Market index quotes (^SPX, ^NDX, ^DJI, ^TASI.SR) for the global topbar ticker.
 * Returns an array of { symbol, price, change, changePct } in a fixed order.
 */
export async function fetchIndexQuotes() {
  const url = `${getApiUrl()}/api/fmp/index-quotes`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "Index quotes");
}
