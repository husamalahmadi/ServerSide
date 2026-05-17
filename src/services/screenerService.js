import { getApiUrl } from "../config/env.js";
import { isUsableScreenerRow } from "../domain/screenerMetrics.js";

let _screenerPromise = null;

/** Clear in-memory screener fetch (e.g. after manual refresh). */
export function clearScreenerCache() {
  _screenerPromise = null;
}

/**
 * Homepage screener — served from GET /api/screener (FMP-built disk cache on server).
 */
export async function getScreenerDataset() {
  if (_screenerPromise) return _screenerPromise;
  _screenerPromise = loadFromApi();
  try {
    return await _screenerPromise;
  } catch (err) {
    _screenerPromise = null;
    throw err;
  }
}

async function loadFromApi() {
  const url = `${getApiUrl()}/api/screener`;
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const json = await res.json().catch(() => ({}));

  if (res.status === 503) {
    const err = new Error(
      json?.error || "Screener data is being built from FMP. Please try again in a few minutes."
    );
    err.code = "SCREENER_BUILDING";
    err.rebuilding = Boolean(json?.rebuilding);
    throw err;
  }

  if (!res.ok) throw new Error(json?.error || `Screener API HTTP ${res.status}`);
  if (!Array.isArray(json?.items)) throw new Error("Screener API: invalid payload");

  const items = json.items.filter(isUsableScreenerRow);
  if (!items.length) {
    const err = new Error(
      json?.error || "Screener data is being built from FMP. Please try again in a few minutes."
    );
    err.code = "SCREENER_BUILDING";
    err.rebuilding = Boolean(json?.rebuilding);
    throw err;
  }

  return {
    items,
    sectors: Array.isArray(json.sectors) ? json.sectors : [],
    meta: json.meta || null,
    rebuilding: Boolean(json.rebuilding),
  };
}
