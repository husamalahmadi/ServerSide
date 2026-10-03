import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

/**
 * Quarterly reported vs expected earnings via Express `/api/fmp/earnings`.
 */
export async function fetchEarnings(fmpSymbol) {
  const sym = String(fmpSymbol || "").trim();
  if (!sym) throw new Error("FMP symbol required");
  const url = `${getApiUrl()}/api/fmp/earnings?${new URLSearchParams({ symbol: sym })}`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "Earnings");
}
