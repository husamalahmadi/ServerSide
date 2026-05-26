import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

export async function fetchUsMarketUniverse() {
  const base = getApiUrl();
  const url = `${base}/api/fmp/us-market-universe`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "S&P 500 universe");
}

export async function fetchSaMarketUniverse() {
  const base = getApiUrl();
  const url = `${base}/api/fmp/sa-market-universe`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "TASI universe");
}
