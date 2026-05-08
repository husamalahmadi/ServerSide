// FILE: src/services/yahooFinance.js
import { getApiUrl } from "../config/env.js";

/**
 * Fetch live stock price via the Express /api/yf/price proxy.
 * @param {string} yfSymbol  "AAPL" for US, "2010.SR" for TASI
 * @returns {Promise<{ price: number|null, currency: string }>}
 */
export async function yfPrice(yfSymbol) {
  const url = `${getApiUrl()}/api/yf/price/${encodeURIComponent(yfSymbol)}`;
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

/**
 * Fetch company profile + logo URL via the Express /api/yf/profile proxy.
 * Returns an object with the exact field names Stock.jsx already expects:
 * symbol, name, industry, sector, description, city, country, CEO, website, phone, logoUrl
 * Never throws — returns {} on any error so the stock page degrades gracefully.
 * @param {string} yfSymbol  "AAPL" for US, "2010.SR" for TASI
 */
export async function yfProfileAndLogo(yfSymbol) {
  try {
    const url = `${getApiUrl()}/api/yf/profile/${encodeURIComponent(yfSymbol)}`;
    const res = await fetch(url, { cache: "no-store", credentials: "include" });
    const json = await res.json();
    if (!res.ok) return {};
    return json;
  } catch {
    return {};
  }
}
