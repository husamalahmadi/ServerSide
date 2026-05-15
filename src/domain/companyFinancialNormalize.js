function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function periodFromRow(r) {
  const fiscal_date = r.fiscal_date ?? r.date ?? null;
  const year = r.year ?? r.fiscalYear ?? (fiscal_date ? String(fiscal_date).slice(0, 4) : null);
  return { fiscal_date, year };
}

/** Unwrap statement rows from nested `{ meta, income_statement: [] }` or a bare FMP array. */
export function statementRows(block) {
  if (!block) return [];
  if (Array.isArray(block)) return block;
  if (Array.isArray(block.income_statement)) return block.income_statement;
  if (Array.isArray(block.balance_sheet)) return block.balance_sheet;
  if (Array.isArray(block.cash_flow)) return block.cash_flow;
  if (Array.isArray(block.statistics)) return block.statistics;
  if (Array.isArray(block.enterprise_values)) return block.enterprise_values;
  return [];
}

function hasFlatNormalizedSeries(d) {
  return Array.isArray(d.sales) && d.sales.some((it) => it?.value != null);
}

/**
 * Normalizes company.data from nested or FMP shapes into flat series
 * expected by tasiToFinancialsFormat / sp500ToFinancialsFormat.
 */
export function normalizeCompanyFinancialRecord(c) {
  if (!c?.data) return c;
  const d = c.data;
  if (hasFlatNormalizedSeries(d)) return c;

  const isRows = statementRows(d.income_statement);
  const bsRows = statementRows(d.balance_sheet);
  const cfRows = statementRows(d.cash_flow);
  const evRows = statementRows(d.enterprise_values);
  const stBlock = d.statistics;
  const stRows = statementRows(stBlock);
  const stObj =
    stBlock?.statistics && typeof stBlock.statistics === "object" && !Array.isArray(stBlock.statistics)
      ? stBlock.statistics
      : null;
  const vm = stObj?.valuations_metrics || {};
  const ss = stObj?.stock_statistics || {};
  const fin = stObj?.financials || {};
  const ev0 = evRows[0] || stRows[0] || null;

  const bs0 = bsRows[0] || {};
  const ca = bs0.assets?.current_assets || bs0;
  const cl = bs0.liabilities?.current_liabilities || bs0;
  const ncl = bs0.liabilities?.non_current_liabilities || bs0;

  const sales = isRows.map((r) => {
    const p = periodFromRow(r);
    return { ...p, value: num(r.sales ?? r.revenue) };
  });
  const gross_profit = isRows.map((r) => {
    const p = periodFromRow(r);
    return { ...p, value: num(r.gross_profit ?? r.grossProfit) };
  });
  const operating_income = isRows.map((r) => {
    const p = periodFromRow(r);
    return { ...p, value: num(r.operating_income ?? r.operatingIncome) };
  });
  const net_income = isRows.map((r) => {
    const p = periodFromRow(r);
    return { ...p, value: num(r.net_income ?? r.netIncome) };
  });
  const equity = bsRows.map((row) => {
    const p = periodFromRow(row);
    const v =
      row.shareholders_equity?.total_shareholders_equity ?? row.totalStockholdersEquity ?? row.totalEquity;
    return { ...p, value: num(v) };
  });
  const free_cash_flow = cfRows.map((r) => {
    const p = periodFromRow(r);
    return { ...p, value: num(r.free_cash_flow ?? r.freeCashFlow) };
  });

  return {
    ...c,
    ticker: c.ticker,
    company: c.company_name || c.company,
    industry: c.industry,
    symbol: c.symbol || c.ticker_full || c.ticker,
    data: {
      enterprise_value: num(vm.enterprise_value ?? ev0?.enterpriseValue ?? ev0?.enterprise_value),
      market_capitalization: num(vm.market_capitalization ?? ev0?.marketCapitalization ?? ev0?.market_capitalization),
      forward_pe: num(vm.forward_pe ?? vm.trailing_pe),
      price_to_sales_ttm: num(vm.price_to_sales_ttm),
      outstanding_common_stocks: num(ss.shares_outstanding ?? ev0?.numberOfShares),
      long_term_debt: num(ncl.long_term_debt ?? bs0.longTermDebt ?? fin.total_debt_mrq),
      short_term_debt: num(cl.short_term_debt ?? bs0.shortTermDebt),
      cash_and_cash_equivalents: num(
        ca.cash_and_cash_equivalents ?? bs0.cashAndCashEquivalents ?? fin.total_cash_mrq
      ),
      sales,
      gross_profit,
      operating_income,
      net_income,
      equity,
      free_cash_flow,
    },
  };
}
