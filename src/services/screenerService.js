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
    return {
      items: [],
      sectors: [],
      meta: json?.meta || null,
      rebuilding: true,
      buildingMessage: json?.error || null,
    };
  }

  if (!res.ok) throw new Error(json?.error || `Screener API HTTP ${res.status}`);
  if (!Array.isArray(json?.items)) throw new Error("Screener API: invalid payload");

  const items = json.items.filter(isUsableScreenerRow);

  return {
    items,
    sectors: Array.isArray(json.sectors) ? json.sectors : [],
    meta: json.meta || null,
    rebuilding: Boolean(json.rebuilding) || (!items.length && json?.meta?.stale),
    buildingMessage: !items.length ? json?.error || null : null,
  };
}
