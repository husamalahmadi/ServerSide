import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

export async function fetchInsiderSignal(symbol) {
  const sym = String(symbol || "").trim();
  if (!sym) throw new Error("Enter a US ticker symbol.");
  const url = `${getApiUrl()}/api/fmp/insider-signal?${new URLSearchParams({ symbol: sym })}`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  return readJsonResponse(res, "Insider signal");
}
