import { FMP_STABLE_BASE } from "./fmpFetch.js";

const QUOTE_CHUNK = 40;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBatchQuoteChunk(symbols, apiKey) {
  if (!symbols.length) return [];
  const url = `${FMP_STABLE_BASE}/batch-quote?${new URLSearchParams({
    symbols: symbols.join(","),
    apikey: apiKey,
  })}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`FMP batch-quote HTTP ${r.status}`);
  let arr;
  try {
    arr = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("FMP batch-quote: invalid JSON");
  }
  if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
    throw new Error(String(arr["Error Message"] || arr.error));
  }
  if (!Array.isArray(arr)) throw new Error("FMP batch-quote: expected array");
  return arr;
}

/** Fetch live quotes for many FMP symbols (chunked). */
export async function fetchAllBatchQuotes(fmpSymbols, apiKey, { delayMs = 120 } = {}) {
  const unique = [...new Set(fmpSymbols.map((s) => String(s).trim()).filter(Boolean))];
  const rows = [];
  for (let i = 0; i < unique.length; i += QUOTE_CHUNK) {
    const chunk = unique.slice(i, i + QUOTE_CHUNK);
    const part = await fetchBatchQuoteChunk(chunk, apiKey);
    rows.push(...part);
    if (i + QUOTE_CHUNK < unique.length) await sleep(delayMs);
  }
  return rows;
}

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
