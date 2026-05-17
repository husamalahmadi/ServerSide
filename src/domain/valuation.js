// FILE: client/src/domain/valuation.js
import { resolveMarketAndSymbol, CURRENCY_BY_MARKET, fmpSymbolFromResolved } from "../data/stocksCatalog.js";
import { coalesce, toNumber } from "./financials.js";
import { fmpQuote, fmpRatios } from "../services/fmpService.js";
import { getFmpCompanyFinancials, fmpToValuationFormat } from "../services/fmpFinancialsService.js";
import { FmpIncompleteError } from "../services/fmpErrors.js";

/**
 * Client-side replacement for GET /api/valuation/:ticker.
 * Financials from FMP statements + enterprise values; live quote and ratios from FMP.
 * Caller can still cache the result in sessionStorage (as the UI already does).
 */
export async function computeValuation({ ticker, market } = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const { market: resolvedMarket, tickerUS, tickerSA } = r;
  const fmpSym = fmpSymbolFromResolved(r);

  let statsJson = {};
  let bsJson = {};
  let isJson = {};

  if (fmpSym) {
    try {
      const bundle = await getFmpCompanyFinancials(fmpSym);
      const v = fmpToValuationFormat(bundle);
      if (v) {
        statsJson = { statistics: v.stats };
        bsJson = { balance_sheet: v.balance_sheet };
        isJson = { income_statement: v.income_statement };
      }
    } catch (err) {
      if (err instanceof FmpIncompleteError) throw err;
      /* valuation continues with quote/ratios only for other errors */
    }
  }

  const [priceJson, ratiosJson] = fmpSym
    ? await Promise.all([fmpQuote(fmpSym).catch(() => ({})), fmpRatios(fmpSym).catch(() => ({}))])
    : [{}, {}];

  const stats = statsJson?.statistics || statsJson || {};
  const price = toNumber(priceJson?.price) ?? 0;

  const bs0 =
    Array.isArray(bsJson?.balance_sheet)
      ? bsJson.balance_sheet[0]
      : Array.isArray(bsJson?.balance_sheet?.annual)
        ? bsJson.balance_sheet.annual.at(-1)
        : bsJson?.balance_sheet || {};

  const is0 =
    Array.isArray(isJson?.income_statement)
      ? isJson.income_statement[0]
      : Array.isArray(isJson?.income_statement?.annual)
        ? isJson.income_statement.annual.at(-1)
        : isJson?.income_statement || {};

  const sharesOutstanding = Math.max(
    0,
    coalesce(
      stats?.stock_statistics?.shares_outstanding,
      stats?.stock_statistics?.shares_outstanding_5y_avg,
      stats?.shares_outstanding
    )
  );

  const evFromStats = coalesce(
    stats?.valuations_metrics?.enterprise_value,
    stats?.valuation?.enterprise_value,
    stats?.enterprise_value
  );

  const longTermDebt = coalesce(
    bs0?.liabilities?.non_current_liabilities?.long_term_debt,
    stats?.financials?.long_term_debt
  );

  const shortTermDebt = coalesce(
    bs0?.liabilities?.current_liabilities?.short_term_debt,
    stats?.financials?.short_term_debt
  );

  const totalDebtApprox = longTermDebt + shortTermDebt;

  const cashEq = coalesce(
    bs0?.assets?.current_assets?.cash_and_cash_equivalents,
    bs0?.assets?.current_assets?.cash,
    stats?.financials?.cash_and_cash_equivalents
  );

  const marketCap = coalesce(
    stats?.valuations_metrics?.market_capitalization,
    stats?.market_cap,
    stats?.valuation?.market_cap
  );

  const enterpriseValue = evFromStats || Math.max(0, marketCap + totalDebtApprox - cashEq);

  const netIncome = coalesce(is0?.net_income, is0?.net_income_loss);
  const sales = coalesce(is0?.sales, is0?.revenue, is0?.total_revenue);
  const eps = coalesce(is0?.eps);

  const peFromFmp = toNumber(ratiosJson?.priceToEarningsRatio);
  const psFromFmp = toNumber(ratiosJson?.priceToSalesRatio);
  const peFromLocal = coalesce(stats?.valuations_metrics?.forward_pe, stats?.valuations_metrics?.trailing_pe);
  const psFromLocal = coalesce(stats?.valuations_metrics?.price_to_sales_ttm);
  const peDerived = price > 0 && eps > 0 ? price / eps : 0;
  const psDerived = price > 0 && sharesOutstanding > 0 && sales > 0 ? (price * sharesOutstanding) / sales : 0;

  function pickPositiveRatio(...candidates) {
    for (const v of candidates) {
      const n = toNumber(v);
      if (n != null && n > 0) return n;
    }
    return 0;
  }

  const forwardPE = pickPositiveRatio(peFromFmp, peFromLocal, peDerived);
  const priceToSales = pickPositiveRatio(psFromFmp, psFromLocal, psDerived);

  const totalEquityRaw =
    bs0?.shareholders_equity?.total_shareholders_equity ??
    bs0?.total_shareholders_equity ??
    bs0?.shareholders_equity?.total_equity;

  const totalEquity = coalesce(totalEquityRaw);
  const equityPerShare = sharesOutstanding > 0 ? totalEquity / sharesOutstanding : 0;

  let fairEV = 0;
  let fairPE = 0;
  let fairPS = 0;

  if (sharesOutstanding > 0) {
    fairEV = (enterpriseValue - longTermDebt + cashEq) / sharesOutstanding;
    fairPE = (forwardPE * netIncome) / sharesOutstanding;
    fairPS = (priceToSales * sales) / sharesOutstanding;
  }

  const currency = CURRENCY_BY_MARKET[resolvedMarket] || (resolvedMarket === "sa" ? "SAR" : "USD");

  return {
    source: "live",
    ticker: resolvedMarket === "us" ? tickerUS : tickerSA,
    market: resolvedMarket,
    fetchedAt: new Date().toISOString(),
    currency,
    price: Number.isFinite(price) ? price : 0,
    fairEV: Number.isFinite(fairEV) ? fairEV : 0,
    fairPE: Number.isFinite(fairPE) ? fairPE : 0,
    fairPS: Number.isFinite(fairPS) ? fairPS : 0,
    equityPerShare: Number.isFinite(equityPerShare) ? equityPerShare : 0,
  };
}
