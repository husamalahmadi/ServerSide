import { FMP_STABLE_BASE, fetchFmpFinancialsBundle, fmpFilterAnnualRows } from "./fmpFetch.js";
import { buildYearlyEvFairValue, aggregateMonthlyPrices } from "../shared/evFairValue.js";

async function parseFmpArray(res, label) {
  const text = await res.text();
  if (!res.ok) throw new Error(`FMP ${label} HTTP ${res.status}`);
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`FMP ${label}: invalid JSON`);
  }
  if (data && typeof data === "object" && !Array.isArray(data) && (data["Error Message"] || data.error)) {
    throw new Error(String(data["Error Message"] || data.error));
  }
  return Array.isArray(data) ? data : [];
}

async function fetchKeyMetricsAnnual(symbol, apiKey, limit = 10) {
  const url = `${FMP_STABLE_BASE}/key-metrics?${new URLSearchParams({
    symbol,
    limit: String(limit),
    apikey: apiKey,
  })}`;
  const r = await fetch(url);
  const rows = await parseFmpArray(r, "key-metrics");
  return rows.filter((row) => row?.period === "FY" || row?.period == null);
}

async function fetchHistoricalLight(symbol, apiKey) {
  const to = new Date().toISOString().slice(0, 10);
  const fromYear = new Date().getFullYear() - 5;
  const from = `${fromYear}-01-01`;
  const url = `${FMP_STABLE_BASE}/historical-price-eod/light?${new URLSearchParams({
    symbol,
    from,
    to,
    apikey: apiKey,
  })}`;
  const r = await fetch(url);
  const rows = await parseFmpArray(r, "historical-price-eod/light");
  return aggregateMonthlyPrices(rows);
}

/**
 * Yearly EV fair value + monthly price history for the stock chart.
 */
export async function fetchFairValueChartData(symbol, apiKey) {
  const [bundle, keyMetrics, monthlyPrices] = await Promise.all([
    fetchFmpFinancialsBundle(symbol, apiKey),
    fetchKeyMetricsAnnual(symbol, apiKey, 10),
    fetchHistoricalLight(symbol, apiKey),
  ]);

  const yearlyFairValue = buildYearlyEvFairValue({
    keyMetrics,
    balanceSheet: fmpFilterAnnualRows(bundle.balance),
    enterpriseValues: fmpFilterAnnualRows(bundle.enterpriseValues),
    incomeStatement: fmpFilterAnnualRows(bundle.income),
  });

  return {
    symbol,
    yearlyFairValue,
    monthlyPrices,
  };
}
