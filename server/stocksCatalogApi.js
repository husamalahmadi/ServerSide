import { loadGroupedCatalog } from "./buildScreenerFromFmp.js";
import { SCREENER_MARKETS } from "./screenerStore.js";

/** Build serializable catalog payload for GET /api/catalog (same markets as client stocksCatalog.js). */
export function buildStocksCatalogPayload() {
  const markets = {};
  let total = 0;

  for (const market of SCREENER_MARKETS) {
    const entries = loadGroupedCatalog(market);
    const list = entries
      .map((e) => ({
        ticker: market === "sa" ? e.ticker : String(e.ticker).toUpperCase(),
        name: e.name,
        industry: e.sector || "",
        market,
      }))
      .sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));

    const inds = [...new Set(list.map((r) => r.industry).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );

    markets[market] = { list, inds, count: list.length };
    total += list.length;
  }

  return {
    total,
    markets,
    updatedAt: new Date().toISOString(),
  };
}
