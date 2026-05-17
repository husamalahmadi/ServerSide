export const FMP_STABLE_BASE = "https://financialmodelingprep.com/stable";

export function fmpApiKey() {
  const k = (process.env.FMP_API_KEY || "").trim();
  return k || null;
}

export async function fmpFetchStableArray(path, symbol, key) {
  const url = `${FMP_STABLE_BASE}/${path}?${new URLSearchParams({ symbol, apikey: key })}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FMP ${path} HTTP ${r.status}`);
  const data = await r.json();
  if (data && typeof data === "object" && !Array.isArray(data) && (data["Error Message"] || data.error)) {
    throw new Error(String(data["Error Message"] || data.error));
  }
  return Array.isArray(data) ? data : [];
}

export function fmpFilterAnnualRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const fy = rows.filter((row) => row?.period === "FY" || row?.period == null);
  return fy.length ? fy : rows;
}

export async function fetchFmpFinancialsBundle(symbol, key) {
  const results = await Promise.allSettled([
    fmpFetchStableArray("income-statement", symbol, key),
    fmpFetchStableArray("balance-sheet-statement", symbol, key),
    fmpFetchStableArray("cash-flow-statement", symbol, key),
    fmpFetchStableArray("enterprise-values", symbol, key),
    fmpFetchStableArray("profile", symbol, key),
  ]);

  const pick = (i) => (results[i].status === "fulfilled" ? results[i].value : []);
  const income = fmpFilterAnnualRows(pick(0));
  const balance = fmpFilterAnnualRows(pick(1));
  const cash = fmpFilterAnnualRows(pick(2));
  const enterpriseValues = fmpFilterAnnualRows(pick(3));
  const profileRows = pick(4);
  const profileRow = Array.isArray(profileRows) ? profileRows[0] : null;
  const companyName = profileRow?.companyName ?? profileRow?.name ?? null;

  const fetchErrors = results
    .map((r, i) => (r.status === "rejected" ? ["income", "balance", "cash", "enterprise_values", "profile"][i] : null))
    .filter(Boolean);

  return {
    symbol,
    companyName,
    income,
    balance,
    cash,
    enterpriseValues,
    fetchErrors,
  };
}
