import { publicUrl } from "../utils/publicUrl.js";

const SP500_DATA_URL = publicUrl("data/sp500_financial_data.json");
const TASI_DATA_URL = publicUrl("data/tasi_financial_data.json");

let _screenerPromise = null;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function collectCompanies(json, market) {
  const out = [];
  const industries = json?.industries;
  if (!industries || typeof industries !== "object") return out;
  for (const [sector, ind] of Object.entries(industries)) {
    const companies = ind?.companies;
    if (!companies || typeof companies !== "object") continue;
    for (const c of Object.values(companies)) {
      const st = c?.data?.statistics?.statistics || {};
      const vm = st?.valuations_metrics || {};
      const fin = st?.financials || {};
      const bsFin = fin?.balance_sheet || {};
      const ss = st?.stock_statistics || {};

      const tickerRaw = String(c?.ticker ?? "").trim();
      const ticker = market === "us" ? tickerRaw.toUpperCase() : tickerRaw;
      if (!ticker) continue;

      const marketCap = num(vm.market_capitalization);
      const enterpriseValue = num(vm.enterprise_value);
      const pe = num(vm.forward_pe ?? vm.trailing_pe);
      const shares = num(ss.shares_outstanding);
      const debt = num(bsFin.total_debt_mrq ?? fin.total_debt_mrq) ?? 0;
      const cash = num(bsFin.total_cash_mrq ?? fin.total_cash_mrq) ?? 0;

      const priceApprox = shares && shares > 0 && marketCap ? marketCap / shares : null;
      const fairValue = shares && shares > 0 && enterpriseValue != null ? (enterpriseValue - debt + cash) / shares : null;
      const discountPct =
        fairValue != null && priceApprox != null && priceApprox > 0
          ? ((fairValue - priceApprox) / priceApprox) * 100
          : null;

      out.push({
        ticker,
        name: String(c?.company_name || c?.company || ticker),
        market,
        sector: String(c?.industry || sector || "").trim(),
        pe,
        marketCap,
        fairValue,
        priceApprox,
        discountPct,
      });
    }
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export async function getScreenerDataset() {
  if (_screenerPromise) return _screenerPromise;
  _screenerPromise = (async () => {
    const [sp500, tasi] = await Promise.all([fetchJson(SP500_DATA_URL), fetchJson(TASI_DATA_URL)]);
    const us = collectCompanies(sp500, "us");
    const sa = collectCompanies(tasi, "sa");
    const items = [...us, ...sa];
    const sectors = Array.from(new Set(items.map((x) => x.sector).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return { items, sectors };
  })();
  return _screenerPromise;
}
