// FILE: client/src/services/tasiDataService.js
/**
 * Loads TASI financial data from local tasi_financial_data.json.
 * Used instead of Twelve Data API for SA (TASI) companies - except stock price.
 */

import { publicUrl } from "../utils/publicUrl.js";

const TASI_DATA_URL = publicUrl("data/tasi_financial_data.json");

let _tasiPromise = null;

/** Legacy shape from tasi_all_financial_data.json (flat data.* series). */
function isLegacyTasiCompanyShape(data) {
  if (!data) return false;
  if (data.statistics?.statistics || data.income_statement?.income_statement) return false;
  return true;
}

/**
 * Converts tasi_financial_data.json (industries + Twelve-style endpoints) into the same
 * company shape as tasi_all_financial_data.json so existing transforms stay unchanged.
 */
function normalizeTasiCompanyRecord(c) {
  if (!c?.data || isLegacyTasiCompanyShape(c.data)) return c;

  const d = c.data;
  const st = d.statistics?.statistics ?? d.statistics;
  const vm = st?.valuations_metrics || {};
  const ss = st?.stock_statistics || {};
  const fin = st?.financials || {};
  const bs = d.balance_sheet?.balance_sheet || [];
  const isRows = d.income_statement?.income_statement || [];
  const cfRows = d.cash_flow?.cash_flow || [];

  const bs0 = bs[0] || {};
  const ca = bs0.assets?.current_assets || {};
  const cl = bs0.liabilities?.current_liabilities || {};
  const ncl = bs0.liabilities?.non_current_liabilities || {};

  const sales = isRows.map((r) => ({
    fiscal_date: r.fiscal_date,
    year: r.year,
    value: r.sales,
  }));
  const gross_profit = isRows.map((r) => ({
    fiscal_date: r.fiscal_date,
    year: r.year,
    value: r.gross_profit,
  }));
  const operating_income = isRows.map((r) => ({
    fiscal_date: r.fiscal_date,
    year: r.year,
    value: r.operating_income,
  }));
  const net_income = isRows.map((r) => ({
    fiscal_date: r.fiscal_date,
    year: r.year,
    value: r.net_income,
  }));
  const equity = bs.map((row) => ({
    fiscal_date: row.fiscal_date,
    year: row.year,
    value: row.shareholders_equity?.total_shareholders_equity,
  }));
  const free_cash_flow = cfRows.map((r) => ({
    fiscal_date: r.fiscal_date,
    year: r.year,
    value: r.free_cash_flow,
  }));

  return {
    ...c,
    ticker: c.ticker,
    company: c.company_name || c.company,
    industry: c.industry,
    symbol: c.symbol || c.ticker_full || c.ticker,
    data: {
      enterprise_value: vm.enterprise_value,
      market_capitalization: vm.market_capitalization,
      forward_pe: vm.forward_pe,
      price_to_sales_ttm: vm.price_to_sales_ttm,
      outstanding_common_stocks: ss.shares_outstanding,
      long_term_debt: ncl.long_term_debt ?? fin.total_debt_mrq,
      short_term_debt: cl.short_term_debt,
      cash_and_cash_equivalents: ca.cash_and_cash_equivalents ?? fin.total_cash_mrq,
      sales,
      gross_profit,
      operating_income,
      net_income,
      equity,
      free_cash_flow,
    },
  };
}

function companiesFromTasiJson(json) {
  if (Array.isArray(json?.companies)) {
    return json.companies.map(normalizeTasiCompanyRecord);
  }
  const out = [];
  const industries = json?.industries;
  if (industries && typeof industries === "object") {
    for (const ind of Object.values(industries)) {
      const cmap = ind?.companies;
      if (!cmap || typeof cmap !== "object") continue;
      for (const c of Object.values(cmap)) {
        out.push(normalizeTasiCompanyRecord(c));
      }
    }
  }
  return out;
}

async function loadTasiData() {
  if (_tasiPromise) return _tasiPromise;
  _tasiPromise = (async () => {
    try {
      const res = await fetch(TASI_DATA_URL, { cache: "no-store" });
      if (!res.ok) return { raw: { companies: [] }, byTicker: new Map() };
      const json = await res.json();
      const companies = companiesFromTasiJson(json);
      const byTicker = new Map();
      for (const c of companies) {
        const t = String(c?.ticker ?? "").trim();
        if (t) byTicker.set(t, c);
      }
      const raw = { meta: json?.meta, companies };
      return { raw, byTicker };
    } catch {
      return { raw: { companies: [] }, byTicker: new Map() };
    }
  })();
  return _tasiPromise;
}

/**
 * Get TASI company data by ticker. Returns null if not found.
 */
export async function getTasiCompanyData(ticker) {
  const { byTicker } = await loadTasiData();
  const t = String(ticker ?? "").trim();
  return byTicker.get(t) ?? byTicker.get(t.toUpperCase()) ?? null;
}

/**
 * Transform TASI data into format expected by mergeFinancials:
 * { income, balance, cash } where each is array of { fiscal_date, year, ... }
 */
export function tasiToFinancialsFormat(companyData) {
  if (!companyData?.data) return { income: [], balance: [], cash: [] };

  const d = companyData.data;
  const years = new Set();
  for (const arr of [d.sales, d.gross_profit, d.operating_income, d.net_income, d.equity, d.free_cash_flow]) {
    for (const it of arr || []) if (it?.fiscal_date) years.add(it.fiscal_date);
  }

  const byDate = new Map();
  for (const fd of years) {
    byDate.set(fd, { fiscal_date: fd, year: null });
  }

  for (const it of d.sales || []) {
    const row = byDate.get(it.fiscal_date);
    if (row) {
      row.year = it.year;
      row.sales = it.value;
    }
  }
  for (const it of d.gross_profit || []) {
    const row = byDate.get(it.fiscal_date);
    if (row) row.gross_profit = it.value;
  }
  for (const it of d.operating_income || []) {
    const row = byDate.get(it.fiscal_date);
    if (row) row.operating_income = it.value;
  }
  for (const it of d.net_income || []) {
    const row = byDate.get(it.fiscal_date);
    if (row) row.net_income = it.value;
  }

  const income = [...byDate.values()].filter((r) => r.sales != null || r.operating_income != null || r.net_income != null);

  const balance = [];
  for (const it of d.equity || []) {
    balance.push({
      fiscal_date: it.fiscal_date,
      year: it.year,
      shareholders_equity: { total_shareholders_equity: it.value },
    });
  }

  const cash = [];
  for (const it of d.free_cash_flow || []) {
    cash.push({
      fiscal_date: it.fiscal_date,
      year: it.year,
      free_cash_flow: it.value,
    });
  }

  return {
    income: income.sort((a, b) => String(a.fiscal_date || "").localeCompare(String(b.fiscal_date || ""))),
    balance,
    cash,
  };
}

/**
 * Transform TASI data into format expected by valuation.js (same structure as Twelve Data API).
 * { stats, balance_sheet, income_statement } for first/latest year
 */
export function tasiToValuationFormat(companyData) {
  if (!companyData?.data) return null;

  const d = companyData.data;
  const stats = {
    valuations_metrics: {
      enterprise_value: d.enterprise_value,
      market_capitalization: d.market_capitalization,
      forward_pe: d.forward_pe,
      price_to_sales_ttm: d.price_to_sales_ttm,
    },
    stock_statistics: {
      shares_outstanding: d.outstanding_common_stocks,
    },
    financials: {
      long_term_debt: d.long_term_debt,
      cash_and_cash_equivalents: d.cash_and_cash_equivalents,
    },
  };

  const eq = d.equity?.[0];
  const inc = [
    {
      sales: d.sales?.[0]?.value,
      net_income: d.net_income?.[0]?.value,
    },
  ];

  const balance = [
    {
      shareholders_equity: eq ? { total_shareholders_equity: eq.value } : {},
      liabilities: {
        current_liabilities: { short_term_debt: d.short_term_debt },
        non_current_liabilities: { long_term_debt: d.long_term_debt },
      },
      assets: {
        current_assets: {
          cash_and_cash_equivalents: d.cash_and_cash_equivalents,
          cash: d.cash_and_cash_equivalents,
        },
      },
    },
  ];

  return {
    stats,
    balance_sheet: balance,
    income_statement: inc,
  };
}
