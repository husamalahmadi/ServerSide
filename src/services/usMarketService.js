import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

/** Last US market weekday (YYYY-MM-DD) for sector/industry snapshots. */
export function defaultSnapshotDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

export async function fetchUsMarketDashboard({ date } = {}) {
  const base = getApiUrl();
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);
  const url = `${base}/api/fmp/us-market-dashboard?${qs}`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "US market dashboard");
}
