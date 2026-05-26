import { loadGroupedCatalog } from "./buildScreenerFromFmp.js";
import { fetchAllBatchQuotes, num } from "./fmpBatchQuotes.js";

function stripMovers(rows) {
  return rows.slice(0, 50).map(({ symbol, name, price }) => ({
    symbol,
    name,
    price,
  }));
}

/** Raw TASI movers with volume (shared by dashboard + home signals). */
export async function computeSaMovers(apiKey) {
  const entries = loadGroupedCatalog("sa");
  const byFmp = new Map(entries.map((e) => [e.fmpSymbol.toUpperCase(), e]));
  const quoteRows = await fetchAllBatchQuotes(
    entries.map((e) => e.fmpSymbol),
    apiKey
  );

  const movers = [];
  for (const q of quoteRows) {
    const sym = String(q?.symbol ?? "").toUpperCase();
    const entry = byFmp.get(sym);
    if (!entry) continue;
    const price = num(q?.price);
    const changesPercentage = num(q?.changesPercentage ?? q?.changePercent);
    const volume = num(q?.volume);
    if (price == null && changesPercentage == null) continue;
    movers.push({
      symbol: entry.ticker,
      name: String(q?.name || entry.name || entry.ticker),
      price: price ?? 0,
      changesPercentage: changesPercentage ?? 0,
      volume: volume ?? 0,
    });
  }
  return movers;
}

/** TASI gainers, losers, and most active from catalog + FMP batch quotes. */
export async function buildSaMarketDashboard(apiKey) {
  const movers = await computeSaMovers(apiKey);

  const withChange = movers.filter((m) => Number.isFinite(m.changesPercentage));
  const gainers = [...withChange].sort((a, b) => b.changesPercentage - a.changesPercentage);
  const losers = [...withChange].sort((a, b) => a.changesPercentage - b.changesPercentage);
  const mostActives = [...movers]
    .filter((m) => Number.isFinite(m.volume) && m.volume > 0)
    .sort((a, b) => b.volume - a.volume);

  return {
    market: "sa",
    gainers: stripMovers(gainers),
    losers: stripMovers(losers),
    mostActives: stripMovers(mostActives),
  };
}
