import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

/**
 * WACC + WACC-based fair value via Express (FMP stable custom-discounted-cash-flow).
 * Returns null on error so the stock page can omit the chip.
 */
export async function fetchCustomDcf(fmpSymbol, market) {
  const sym = String(fmpSymbol || "").trim();
  if (!sym) return null;
  const params = new URLSearchParams({ symbol: sym });
  if (market) params.set("market", String(market));
  const url = `${getApiUrl()}/api/fmp/custom-dcf?${params}`;
  try {
    const res = await fetchWithRetry(url, {
      cache: "no-store",
      credentials: "omit",
    });
    const data = await readJsonResponse(res, "FMP custom DCF");
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}
