// FILE: client/src/services/priceService.js
import { resolveMarketAndSymbol } from "../data/stocksCatalog.js";
import { toNumber } from "../domain/financials.js";
import { yfPrice } from "./yahooFinance.js";

/**
 * Client-side replacement for GET /api/price/:ticker
 */
export async function getLivePrice({ ticker, market } = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const { currency, market: resolvedMarket, tickerUS, tickerSA } = r;
  const yfSymbol = resolvedMarket === "sa" ? `${tickerSA}.SR` : tickerUS;
  const j = await yfPrice(yfSymbol);
  const price = toNumber(j?.price) ?? 0;

  return {
    source: "yahoo",
    ticker: resolvedMarket === "us" ? tickerUS : tickerSA,
    market: resolvedMarket,
    price: Number.isFinite(price) ? price : 0,
    currency: j?.currency || currency,
    fetchedAt: new Date().toISOString(),
  };
}