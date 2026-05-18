function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isPositive(n) {
  const x = num(n);
  return x != null && x > 0;
}

/** Row has enough data to show in the screener table. */
export function isUsableScreenerRow(row) {
  if (!row?.ticker) return false;
  return isPositive(row.marketCap);
}

/** True when at least half of a market's screener rows have usable metrics. */
export function screenerMarketUsable(items) {
  if (!Array.isArray(items) || !items.length) return false;
  const usable = items.filter(isUsableScreenerRow).length;
  return usable / items.length >= 0.5;
}

function latestRow(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0];
}

/** Legacy statistics block (valuations_metrics on company.data). */
function metricsFromLegacyStatistics(c) {
  const st = c?.data?.statistics?.statistics || {};
  const vm = st?.valuations_metrics || {};
  const fin = st?.financials || {};
  const bsFin = fin?.balance_sheet || {};
  const ss = st?.stock_statistics || {};

  const marketCap = num(vm.market_capitalization);
  const enterpriseValue = num(vm.enterprise_value);
  const pe = num(vm.forward_pe ?? vm.trailing_pe);
  const shares = num(ss.shares_outstanding);
  const debt = num(bsFin.total_debt_mrq ?? fin.total_debt_mrq) ?? 0;
  const cash = num(bsFin.total_cash_mrq ?? fin.total_cash_mrq) ?? 0;

  const priceApprox = shares && shares > 0 && marketCap ? marketCap / shares : null;
  const fairValue =
    shares && shares > 0 && enterpriseValue != null ? (enterpriseValue - debt + cash) / shares : null;
  const discountPct =
    fairValue != null && priceApprox != null && priceApprox > 0
      ? ((fairValue - priceApprox) / priceApprox) * 100
      : null;

  return {
    pe: isPositive(pe) ? pe : null,
    marketCap: isPositive(marketCap) ? marketCap : null,
    fairValue: isPositive(fairValue) ? fairValue : null,
    priceApprox: isPositive(priceApprox) ? priceApprox : null,
    discountPct,
  };
}

/** Financial Modeling Prep arrays on company.data. */
function metricsFromFmp(c) {
  const ev0 = latestRow(c?.data?.enterprise_values);
  const bs0 = latestRow(c?.data?.balance_sheet);
  const is0 = latestRow(c?.data?.income_statement);

  const marketCap = num(ev0?.marketCapitalization);
  const enterpriseValue = num(ev0?.enterpriseValue);
  const shares = num(ev0?.numberOfShares);
  const priceApprox = num(ev0?.stockPrice) ?? (shares && shares > 0 && marketCap ? marketCap / shares : null);
  const debt = num(bs0?.totalDebt) ?? 0;
  const cash = num(bs0?.cashAndCashEquivalents) ?? 0;

  const eps = num(is0?.eps);
  let pe = null;
  if (priceApprox != null && eps != null && eps > 0) pe = priceApprox / eps;

  const fairValue =
    shares && shares > 0 && enterpriseValue != null ? (enterpriseValue - debt + cash) / shares : null;
  const discountPct =
    fairValue != null && priceApprox != null && priceApprox > 0
      ? ((fairValue - priceApprox) / priceApprox) * 100
      : null;

  return {
    pe: isPositive(pe) ? pe : null,
    marketCap: isPositive(marketCap) ? marketCap : null,
    fairValue: isPositive(fairValue) ? fairValue : null,
    priceApprox: isPositive(priceApprox) ? priceApprox : null,
    discountPct,
  };
}

function isFmpCompanyData(data) {
  if (!data) return false;
  if (data.statistics?.statistics) return false;
  return Array.isArray(data.enterprise_values) || Array.isArray(data.income_statement);
}

/**
 * @param {object} c company record (FMP statement bundles on company.data)
 * @param {"us"|"sa"} market
 * @param {string} sector
 */
export function screenerRowFromCompany(c, market, sector) {
  const tickerRaw = String(c?.ticker ?? "").trim();
  const ticker = market === "us" ? tickerRaw.toUpperCase() : tickerRaw;
  if (!ticker) return null;

  const metrics = isFmpCompanyData(c?.data) ? metricsFromFmp(c) : metricsFromLegacyStatistics(c);

  return {
    ticker,
    name: String(c?.company_name || c?.company || ticker),
    market,
    sector: String(c?.industry || sector || "").trim(),
    ...metrics,
  };
}

/** Merge API screener rows with catalog entries missing from FMP cache (metrics null until built). */
export function mergeScreenerWithCatalog(screenerItems, catalogItems) {
  const key = (r) => `${r.market}:${String(r.ticker).toUpperCase()}`;
  const byKey = new Map();
  for (const r of screenerItems || []) {
    byKey.set(key(r), r);
  }
  const out = [...(screenerItems || [])];
  const seen = new Set(out.map(key));
  for (const c of catalogItems || []) {
    if (!c?.ticker || !c?.market) continue;
    const k = key(c);
    if (seen.has(k)) continue;
    out.push({
      ticker: c.ticker,
      name: c.name,
      market: c.market,
      sector: c.industry || (c.market === "jp" ? "Tokyo Stock Exchange" : ""),
      pe: null,
      marketCap: null,
      fairValue: null,
      priceApprox: null,
      discountPct: null,
    });
    seen.add(k);
  }
  return out;
}

export function collectScreenerItems(json, market) {
  const out = [];
  const industries = json?.industries;
  if (!industries || typeof industries !== "object") return out;
  for (const [sector, ind] of Object.entries(industries)) {
    const companies = ind?.companies;
    if (!companies || typeof companies !== "object") continue;
    for (const c of Object.values(companies)) {
      const row = screenerRowFromCompany(c, market, sector);
      if (isUsableScreenerRow(row)) out.push(row);
    }
  }
  return out;
}
