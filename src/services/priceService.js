// FILE: client/src/services/priceService.js
import { resolveMarketAndSymbol, fmpSymbolFromResolved } from "../data/stocksCatalog.js";
import { toNumber } from "../domain/financials.js";
import { fmpQuote } from "./fmpService.js";

/**
 * Client-side replacement for GET /api/price/:ticker
 */
export async function getLivePrice({ ticker, market } = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const fmpSym = fmpSymbolFromResolved(r);
  if (!fmpSym) throw new Error("Ticker not allowed.");

  const { currency, market: resolvedMarket, tickerDisplay } = r;
  let j;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      j = await fmpQuote(fmpSym);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  if (lastErr) throw lastErr;

  const price = toNumber(j?.price) ?? 0;

  return {
    source: "live",
    ticker: tickerDisplay,
    market: resolvedMarket,
    price: Number.isFinite(price) ? price : 0,
    currency,
    fetchedAt: new Date().toISOString(),
  };
}