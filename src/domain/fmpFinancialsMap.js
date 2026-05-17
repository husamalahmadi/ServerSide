/**
 * Maps FMP stable statement payloads into shapes used by mergeFinancials and valuation.js.
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ income?: object[], balance?: object[], cash?: object[], enterpriseValues?: object[] }} bundle
 */
export function fmpStatementsToMergeInputs(bundle) {
  if (!bundle) return { income: [], balance: [], cash: [] };

  const income = (bundle.income || []).map((row) => ({
    fiscal_date: row.date,
    fiscal_year: row.fiscalYear,
    year: row.fiscalYear,
    date: row.date,
    sales: row.revenue,
    revenue: row.revenue,
    total_revenue: row.revenue,
    operating_income: row.operatingIncome,
    operatingIncome: row.operatingIncome,
    net_income: row.netIncome,
    netIncome: row.netIncome,
    gross_profit: row.grossProfit,
    eps: row.eps,
  }));

  const balance = (bundle.balance || []).map((row) => ({
    fiscal_date: row.date,
    fiscal_year: row.fiscalYear,
    year: row.fiscalYear,
    date: row.date,
    shareholders_equity: { total_shareholders_equity: row.totalStockholdersEquity ?? row.totalEquity },
    total_shareholders_equity: row.totalStockholdersEquity ?? row.totalEquity,
    liabilities: {
      current_liabilities: { short_term_debt: row.shortTermDebt },
      non_current_liabilities: { long_term_debt: row.longTermDebt },
    },
    assets: {
      current_assets: { cash_and_cash_equivalents: row.cashAndCashEquivalents },
    },
  }));

  const cash = (bundle.cash || []).map((row) => ({
    fiscal_date: row.date,
    fiscal_year: row.fiscalYear,
    year: row.fiscalYear,
    date: row.date,
    free_cash_flow: row.freeCashFlow,
    freeCashFlow: row.freeCashFlow,
    operating_cash_flow: row.operatingCashFlow,
    capital_expenditures: row.capitalExpenditure,
  }));

  return { income, balance, cash };
}

/**
 * Latest period stats for valuation (index 0 = most recent FY from FMP).
 * @returns {{ stats: object, balance_sheet: object[], income_statement: object[] } | null}
 */
export function fmpStatementsToValuation(bundle) {
  if (!bundle) return null;

  const is0 = bundle.income?.[0];
  const bs0 = bundle.balance?.[0];
  const ev0 = bundle.enterpriseValues?.[0];

  const shares = num(ev0?.numberOfShares);
  const enterpriseValue = num(ev0?.enterpriseValue);
  const marketCap = num(ev0?.marketCapitalization);

  if (!is0 && !bs0 && !ev0) return null;
  if (shares == null || shares <= 0) return null;
  if (enterpriseValue == null && marketCap == null && !bs0) return null;

  const stats = {
    valuations_metrics: {
      enterprise_value: enterpriseValue,
      market_capitalization: marketCap,
    },
    stock_statistics: {
      shares_outstanding: shares,
    },
    financials: {
      long_term_debt: num(bs0?.longTermDebt),
      short_term_debt: num(bs0?.shortTermDebt),
      cash_and_cash_equivalents: num(bs0?.cashAndCashEquivalents),
    },
  };

  const balance_sheet = [
    {
      shareholders_equity: {
        total_shareholders_equity: num(bs0?.totalStockholdersEquity ?? bs0?.totalEquity),
      },
      liabilities: {
        current_liabilities: { short_term_debt: num(bs0?.shortTermDebt) },
        non_current_liabilities: { long_term_debt: num(bs0?.longTermDebt) },
      },
      assets: {
        current_assets: {
          cash_and_cash_equivalents: num(bs0?.cashAndCashEquivalents),
          cash: num(bs0?.cashAndCashEquivalents),
        },
      },
    },
  ];

  const income_statement = [
    {
      sales: num(is0?.revenue),
      revenue: num(is0?.revenue),
      net_income: num(is0?.netIncome),
      eps: num(is0?.eps),
    },
  ];

  return { stats, balance_sheet, income_statement };
}
