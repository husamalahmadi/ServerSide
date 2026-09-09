import { FMP_STABLE_BASE } from "./fmpFetch.js";
import { dcfSymbolCandidates } from "./fmpDcf.js";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && !payload["Error Message"] && !payload.error) {
    return [payload];
  }
  return [];
}

/** FMP may send 0.085 or 8.5; store as a percent (8.5). */
export function parseWaccPct(raw) {
  const n = num(raw);
  if (n == null || n === 0) return null;
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  if (!Number.isFinite(pct) || pct <= 0 || pct > 80) return null;
  return pct;
}

export function parseCustomDcfPayload(payload, fallbackSymbol) {
  const rows = rowsFromPayload(payload).filter((r) => r && typeof r === "object");
  if (!rows.length) return null;

  let wacc = null;
  let fairValue = null;
  let year = null;
  for (const row of [...rows].reverse()) {
    if (wacc == null) wacc = parseWaccPct(row.wacc);
    if (fairValue == null) {
            const fv = num(row.equityValuePerShare ?? row.equity_value_per_share);
      if (fv != null && fv > 0) fairValue = fv;
    }
    if (year == null && row.year != null) year = row.year;
    if (wacc != null && fairValue != null) break;
  }

  if (wacc == null && fairValue == null) return null;
  return {
    symbol: String(rows[0].symbol ?? fallbackSymbol ?? "").trim() || fallbackSymbol,
    wacc,
    fairValue,
    year: year != null ? Number(year) || year : null,
  };
}

async function fetchCustomDcfRaw(symbol, apiKey) {
  const url = `${FMP_STABLE_BASE}/custom-discounted-cash-flow?${new URLSearchParams({
    symbol,
    apikey: apiKey,
  })}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`FMP custom DCF HTTP ${r.status}`);
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("FMP custom DCF: invalid JSON");
  }
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    (payload["Error Message"] || payload.error)
  ) {
    throw new Error(String(payload["Error Message"] || payload.error));
  }
  const parsed = parseCustomDcfPayload(payload, symbol);
  if (!parsed) throw new Error("FMP custom DCF: empty");
  return parsed;
}

export async function fetchCustomDcfWithFallback(symbols, apiKey) {
  let lastError = new Error("FMP custom DCF: no symbol");
  for (const sym of symbols) {
    try {
      const row = await fetchCustomDcfRaw(sym, apiKey);
      if (row.wacc != null || row.fairValue != null) return { ...row, fmpSymbolUsed: sym };
      lastError = new Error("FMP custom DCF: missing wacc");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export function customDcfCandidates(symbol, market) {
  const list = dcfSymbolCandidates(symbol, market);
  return list.length ? list : [String(symbol || "").trim()].filter(Boolean);
}
