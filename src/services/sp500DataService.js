// FILE: client/src/services/sp500DataService.js
/**
 * Loads S&P 500 financial data from local sp500_all_financial_data.json.
 * Used instead of Twelve Data API for US (S&P 500) companies - except stock price.
 */

import { publicUrl } from "../utils/publicUrl.js";

const SP500_DATA_URL = publicUrl("data/sp500_all_financial_data.json");

let _sp500Promise = null;

async function loadSp500Data() {
  if (_sp500Promise) return _sp500Promise;
  _sp500Promise = (async () => {
    try {
      const res = await fetch(SP500_DATA_URL, { cache: "no-store" });
      if (!res.ok) return { raw: { companies: [] }, byTicker: new Map() };
      const json = await res.json();
      const byTicker = new Map();
      for (const c of json?.companies || []) {
        const t = String(c?.ticker ?? "").trim().toUpperCase();
        if (t) byTicker.set(t, c);
      }
      return { raw: json, byTicker };
    } catch {
      return { raw: { companies: [] }, byTicker: new Map() };
    }
  })();
  return _sp500Promise;
}

/**
 * Get S&P 500 company data by ticker. Returns null if not found.
 */
export async function getSp500CompanyData(ticker) {
  const { byTicker } = await loadSp500Data();
  const t = String(ticker ?? "").trim().toUpperCase();
  return byTicker.get(t) ?? null;
}

/**
 * Transform S&P 500 data into format expected by mergeFinancials:
 * { income, balance, cash } where each is array of { fiscal_date, year, ... }
 */
export function sp500ToFinancialsFormat(companyData) {
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
 * Transform S&P 500 data into format expected by valuation.js (same structure as Twelve Data API).
 * { stats, balance_sheet, income_statement } for first/latest year
 */
export function sp500ToValuationFormat(companyData) {
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
