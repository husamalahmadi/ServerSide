import { FMP_STABLE_BASE } from "./fmpFetch.js";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Build FMP symbol attempts (e.g. 5110 → 5110.SR and 5110). */
export function dcfSymbolCandidates(symbol, market) {
  const raw = String(symbol ?? "").trim();
  if (!raw) return [];
  const out = [];
  const add = (s) => {
    const v = String(s).trim();
    if (v && !out.some((x) => x.toUpperCase() === v.toUpperCase())) out.push(v);
  };
  add(raw);
  const upper = raw.toUpperCase();
  const m = String(market ?? "").toLowerCase();
  if (m === "sa" || upper.endsWith(".SR")) {
    const base = raw.replace(/\.sr$/i, "");
    add(`${base}.SR`);
    add(base);
  }
  return out;
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && !payload["Error Message"] && !payload.error) {
    return [payload];
  }
  return [];
}

/** Parse one FMP discounted-cash-flow row (field names vary by API version). */
export function parseFmpDcfRow(item, fallbackSymbol) {
  if (!item || typeof item !== "object") return null;
  const dcf = num(item.dcf ?? item.DCF ?? item.discountedCashFlow ?? item.fairValue);
  const stockPrice = num(
    item["Stock Price"] ?? item.stockPrice ?? item.price ?? item["stock price"]
  );
  if (dcf == null) return null;
  return {
    symbol: String(item.symbol ?? fallbackSymbol ?? "").trim() || fallbackSymbol,
    date: String(item.date ?? "").slice(0, 10) || null,
    dcf,
    stockPrice,
  };
}

async function fetchDcfRaw(symbol, apiKey) {
  const url = `${FMP_STABLE_BASE}/discounted-cash-flow?${new URLSearchParams({
    symbol,
    apikey: apiKey,
  })}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`FMP DCF HTTP ${r.status}`);
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("FMP DCF: invalid JSON");
  }
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    (payload["Error Message"] || payload.error)
  ) {
    throw new Error(String(payload["Error Message"] || payload.error));
  }
  const rows = rowsFromPayload(payload);
  if (!rows.length) throw new Error("FMP DCF: empty");
  const parsed = parseFmpDcfRow(rows[0], symbol);
  if (!parsed) throw new Error("FMP DCF: missing dcf field");
  return parsed;
}

/**
 * Fetch DCF for the first symbol variant that returns a finite value from FMP.
 */
export async function fetchDcfWithFallback(symbols, apiKey) {
  let lastError = new Error("FMP DCF: no symbol");
  for (const sym of symbols) {
    try {
      const row = await fetchDcfRaw(sym, apiKey);
      if (Number.isFinite(row.dcf)) return { ...row, fmpSymbolUsed: sym };
      lastError = new Error("FMP DCF: missing dcf field");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
