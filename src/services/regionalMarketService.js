import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

/**
 * @param {"sa"|"jp"} market
 */
export async function fetchRegionalMarketDashboard(market) {
  const base = getApiUrl();
  const slug = market === "sa" ? "sa-market-dashboard" : "jp-market-dashboard";
  const url = `${base}/api/fmp/${slug}`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, `${market.toUpperCase()} market dashboard`);
}
