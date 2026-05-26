import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

export async function fetchHomeSignals() {
  const base = getApiUrl();
  const url = `${base}/api/fmp/home-signals`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "Home signals");
}
