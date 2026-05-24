import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

export async function fetchSaMarketDashboard() {
  const base = getApiUrl();
  const url = `${base}/api/fmp/sa-market-dashboard`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "TASI market dashboard");
}
