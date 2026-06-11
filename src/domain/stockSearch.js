/** @param {string} q */
export function normalizeSearchQuery(q) {
  return String(q ?? "").trim().toLowerCase();
}

/**
 * Lower score = better match. Returns -1 if no match.
 * @param {{ ticker?: string, name?: string, market?: string }} item
 * @param {string} query raw user input
 */
export function stockSearchScore(item, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return -1;

  const ticker = String(item?.ticker ?? "").trim();
  const tickerLow = ticker.toLowerCase();
  const nameLow = String(item?.name ?? "").trim().toLowerCase();

  if (tickerLow === q) return 0;

  // Tokyo: allow "7203" to match "7203.T"
  if (item?.market === "jp" && /^\d+$/.test(q)) {
    const bare = tickerLow.replace(/\.t$/i, "");
    if (bare === q) return 0;
    const withT = `${q}.t`;
    if (tickerLow === withT) return 0;
  }

  // London: allow "GLEN" to match "GLEN.L"
  if (item?.market === "uk" && !q.includes(".")) {
    const bare = tickerLow.replace(/\.l$/i, "");
    if (bare === q) return 0;
    if (tickerLow === `${q}.l`) return 0;
  }

  // Numeric tickers (TASI and similar): exact match only at top rank
  if (/^\d+$/.test(q)) {
    const qBare = q.replace(/^0+/, "") || q;
    if (tickerLow === q || tickerLow === qBare) return 0;
  }

  if (tickerLow.startsWith(q)) return 1;
  if (nameLow.startsWith(q)) return 2;
  if (tickerLow.includes(q)) return 3;
  if (nameLow.includes(q)) return 4;
  return -1;
}

/**
 * @param {Array<{ ticker?: string, name?: string, market?: string }>} items
 * @param {string} query
 * @param {{ market?: "all"|"us"|"sa"|"jp"|"uk", limit?: number }} [opts]
 */
export function filterStocksByQuery(items, query, opts = {}) {
  const { market = "all", limit = 8 } = opts;
  const q = normalizeSearchQuery(query);
  if (!q) return [];

  const ranked = [];
  for (const item of items || []) {
    if (market !== "all" && item?.market !== market) continue;
    const score = stockSearchScore(item, query);
    if (score < 0) continue;
    ranked.push({ item, score });
  }

  ranked.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return String(a.item.ticker).localeCompare(String(b.item.ticker));
  });

  return ranked.slice(0, limit).map((r) => r.item);
}
