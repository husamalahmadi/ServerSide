// FILE: client/src/services/financialsService.js
import { getCached, setCached, delCached } from "../cache/browserCache.js";
import { resolveMarketAndSymbol, fmpSymbolFromResolved } from "../data/stocksCatalog.js";
import { mergeFinancials } from "../domain/financials.js";
import { getFmpCompanyFinancials, fmpToFinancialsFormat } from "./fmpFinancialsService.js";
import { FmpIncompleteError } from "./fmpErrors.js";

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Client-side replacement for GET /api/financials/:ticker.
 * Financial statements from FMP stable API (income, balance, cash flow).
 * Only caches when years.length > 0.
 */
export async function getFinancialsCached({
  ticker,
  market,
  ttlMs = DAYS_30_MS,
  storage = "local", // "local" | "session"
} = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const tickerKey = r.market === "us" ? r.tickerUS : r.tickerSA;
  const cacheKey = `fmp_fin_${r.market}_${tickerKey}`;

  const cached = getCached(cacheKey, { ttlMs, storage });
  if (cached) {
    const hasYears = Array.isArray(cached?.years) && cached.years.length > 0;
    if (hasYears) return { source: "cache", ...cached };
    delCached(cacheKey, { storage });
  }

  const warnings = [];
  let income = [];
  let balance = [];
  let cash = [];

  const fmpSym = fmpSymbolFromResolved(r);
  if (fmpSym) {
    try {
      const bundle = await getFmpCompanyFinancials(fmpSym);
      const mapped = fmpToFinancialsFormat(bundle);
      income = mapped.income;
      balance = mapped.balance;
      cash = mapped.cash;
    } catch (err) {
      if (err instanceof FmpIncompleteError) throw err;
      warnings.push(`fmp_financials: ${err?.message || "fetch failed"}`);
    }
  } else {
    warnings.push("fmp_symbol_unresolved");
  }

  if (!income?.length && !balance?.length && !cash?.length) {
    warnings.push("no_fmp_financial_data");
  }

  const merged = mergeFinancials({
    income,
    balance,
    cash,
    ticker: tickerKey,
    warnings,
  });

  const payload = { market: r.market, ...merged };

  const hasYears = Array.isArray(payload.years) && payload.years.length > 0;
  if (hasYears) {
    setCached(cacheKey, payload, { storage });
    return { source: "fmp", ...payload };
  }

  delCached(cacheKey, { storage });
  return { source: "fmp-empty", ...payload };
}
