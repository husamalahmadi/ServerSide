// FILE: client/src/services/financialsService.js
import { getCached, setCached, delCached } from "../cache/browserCache.js";
import { resolveMarketAndSymbol, buildSymbolCandidates } from "../data/stocksCatalog.js";
import { mergeFinancials } from "../domain/financials.js";
import { twelveIncomeStatement, twelveBalanceSheet, twelveCashFlow } from "./twelveData.js";
import { getTasiCompanyData, tasiToFinancialsFormat } from "./tasiDataService.js";
import { getSp500CompanyData, sp500ToFinancialsFormat } from "./sp500DataService.js";
import { getEgxCompanyData, egxToFinancialsFormat } from "./egxDataService.js";

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Client-side replacement for GET /api/financials/:ticker.
 * - TASI (SA): uses local tasi_financial_data.json (no API).
 * - US (S&P 500): uses local sp500_financial_data.json (no API).
 * - Falls back to Twelve Data API when local data is empty.
 * - Only caches when years.length > 0 (same as server behavior).
 */
export async function getFinancialsCached({
  ticker,
  market,
  ttlMs = DAYS_30_MS,
  storage = "local", // "local" | "session"
} = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const resolvedTicker = r.market === "us" ? r.tickerUS : r.market === "sa" ? r.tickerSA : r.tickerEG;
  const cacheKey = `local_fin_${r.market}_${resolvedTicker}`;

  const cached = getCached(cacheKey, { ttlMs, storage });
  if (cached) {
    const hasYears = Array.isArray(cached?.years) && cached.years.length > 0;
    if (hasYears) return { source: "cache", ...cached };
    delCached(cacheKey, { storage });
  }

  const warnings = [];
  let income = null;
  let balance = null;
  let cash = null;

  if (r.market === "sa") {
    const tasiData = await getTasiCompanyData(r.tickerSA);
    if (tasiData) {
      const { income: i, balance: b, cash: c } = tasiToFinancialsFormat(tasiData);
      income = i;
      balance = b;
      cash = c;
    }
  } else if (r.market === "us") {
    const sp500Data = await getSp500CompanyData(r.tickerUS);
    if (sp500Data) {
      const { income: i, balance: b, cash: c } = sp500ToFinancialsFormat(sp500Data);
      income = i;
      balance = b;
      cash = c;
    }
  } else if (r.market === "eg") {
    const egxData = await getEgxCompanyData(r.tickerEG);
    if (egxData) {
      const { income: i, balance: b, cash: c } = egxToFinancialsFormat(egxData);
      income = i;
      balance = b;
      cash = c;
    }
  }

  if (!income?.length && !balance?.length && !cash?.length) {
    const symbolCandidates = buildSymbolCandidates(r);
    const fetchForSymbol = async (fn, label) => {
      let lastErr = null;
      for (const s of symbolCandidates) {
        try {
          const out = await fn(s);
          const annual = out?.[label];
          if (Array.isArray(annual) && annual.length > 0) return out;
          // keep trying other symbol formats if this one returned empty.
        } catch (e) {
          lastErr = e;
        }
      }
      if (lastErr) warnings.push(`${label}: ${lastErr.message}`);
      return null;
    };
    [income, balance, cash] = await Promise.all([
      fetchForSymbol((s) => twelveIncomeStatement(s, { period: "annual" }), "income_statement"),
      fetchForSymbol((s) => twelveBalanceSheet(s, { period: "annual" }), "balance_sheet"),
      fetchForSymbol((s) => twelveCashFlow(s, { period: "annual" }), "cash_flow"),
    ]);
  }

  const merged = mergeFinancials({
    income,
    balance,
    cash,
    ticker: resolvedTicker,
    warnings,
  });

  const payload = { market: r.market, ...merged };

  const hasYears = Array.isArray(payload.years) && payload.years.length > 0;
  if (hasYears) {
    setCached(cacheKey, payload, { storage });
    const src = r.market === "sa" ? "tasi" : r.market === "us" ? "sp500" : r.market === "eg" ? "egx" : "live";
    return { source: src, ...payload };
  }

  delCached(cacheKey, { storage });
  return { source: "live-empty", ...payload };
}