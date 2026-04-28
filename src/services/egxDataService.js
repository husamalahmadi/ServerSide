import { publicUrl } from "../utils/publicUrl.js";
import { normalizeEgxTicker } from "../data/stocksCatalog.js";

const EGX_DATA_URL = publicUrl("data/egx_financial_data.json");

let _egxPromise = null;

function isLegacyEgxCompanyShape(data) {
  if (!data) return false;
  if (data.statistics?.statistics || data.income_statement?.income_statement) return false;
  return true;
}

function normalizeEgxCompanyRecord(c) {
  if (!c?.data || isLegacyEgxCompanyShape(c.data)) return c;

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
    ticker: c.ticker || c.symbol,
    company: c.company_name || c.company,
    industry: c.industry || c.sector,
    symbol: c.symbol || c.ticker,
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

function companiesFromEgxJson(json) {
  if (Array.isArray(json?.companies)) {
    return json.companies.map(normalizeEgxCompanyRecord);
  }
  const out = [];
  const sectors = json?.sectors || json?.industries;
  if (sectors && typeof sectors === "object") {
    for (const [sectorName, sec] of Object.entries(sectors)) {
      const cmap = sec?.companies;
      if (!cmap || typeof cmap !== "object") continue;
      for (const [ticker, c] of Object.entries(cmap)) {
        out.push(
          normalizeEgxCompanyRecord({
            ...c,
            ticker: c?.ticker || c?.symbol || ticker,
            symbol: c?.symbol || c?.ticker || ticker,
            industry: c?.industry || c?.sector || sectorName,
            sector: c?.sector || c?.industry || sectorName,
          })
        );
      }
    }
  }
  return out;
}

async function loadEgxData() {
  if (_egxPromise) return _egxPromise;
  _egxPromise = (async () => {
    try {
      const res = await fetch(EGX_DATA_URL, { cache: "no-store" });
      if (!res.ok) return { raw: { companies: [] }, byTicker: new Map() };
      const json = await res.json();
      const companies = companiesFromEgxJson(json);
      const byTicker = new Map();
      for (const c of companies) {
        const t = String(c?.ticker ?? "").trim().toUpperCase();
        if (t) {
          byTicker.set(t, c);
          const normalized = normalizeEgxTicker(t);
          if (normalized && normalized !== t) byTicker.set(normalized, c);
        }
      }
      const raw = { meta: json?.meta, companies };
      return { raw, byTicker };
    } catch {
      return { raw: { companies: [] }, byTicker: new Map() };
    }
  })();
  return _egxPromise;
}

export async function getEgxCompanyData(ticker) {
  const { byTicker } = await loadEgxData();
  const t = String(ticker ?? "").trim().toUpperCase();
  const normalized = normalizeEgxTicker(t);
  return byTicker.get(t) ?? byTicker.get(normalized) ?? null;
}

export function egxToFinancialsFormat(companyData) {
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

export function egxToValuationFormat(companyData) {
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
