// FILE: src/data/stocksCatalog.js
import { publicUrl } from "../utils/publicUrl.js";

const DATA_FILES = {
  us: publicUrl("data/sp500_grouped_by_industry.json"),
  sa: publicUrl("data/tasi_grouped_by_industry.json"),
  eg: publicUrl("data/egx_grouped_by_sector.json"),
};

export const CURRENCY_BY_MARKET = { us: "USD", sa: "SAR", eg: "EGP" };

export function normalizeEgxTicker(rawTicker) {
  return String(rawTicker || "")
    .trim()
    .toUpperCase()
    .replace(/\.EGP$/i, "");
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();

  let json = {};
  try {
    json = txt ? JSON.parse(txt) : {};
  } catch {
    throw new Error(`Bad JSON ${res.status}: ${txt?.slice(0, 150)}`);
  }

  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return json;
}

function normalizeGrouped(grouped, { tickerUppercase, market }) {
  const flat = [];
  const inds = [];

  for (const [industry, items] of Object.entries(grouped || {})) {
    inds.push(industry);
    for (const it of items || []) {
      const rawTicker = String(it?.Ticker ?? it?.ticker ?? it?.Symbol ?? it?.symbol ?? "").trim();
      const ticker = market === "eg" ? normalizeEgxTicker(rawTicker) : tickerUppercase ? rawTicker.toUpperCase() : rawTicker;
      const name = String(it?.Company ?? it?.name ?? "").trim();
      const figi = String(it?.FIGI ?? it?.figi ?? "").trim().toUpperCase();
      if (!ticker || !name) continue;
      flat.push({ ticker, name, industry, market, figi: figi || null });
    }
  }

  flat.sort((a, b) => a.ticker.toString().localeCompare(b.ticker.toString()));
  inds.sort((a, b) => a.localeCompare(b));

  const byUpperTicker = new Map();
  const upperSet = new Set();
  for (const it of flat) {
    const up = String(it.ticker).toUpperCase();
    byUpperTicker.set(up, it);
    upperSet.add(up);
  }

  return { list: flat, inds, byUpperTicker, upperSet };
}

let _catalogPromise = null;
async function ensureCatalog() {
  if (_catalogPromise) return _catalogPromise;

  _catalogPromise = (async () => {
    const [usRaw, saRaw, egRaw] = await Promise.all([
      fetchJson(DATA_FILES.us),
      fetchJson(DATA_FILES.sa),
      fetchJson(DATA_FILES.eg),
    ]);

    const us = normalizeGrouped(usRaw, { tickerUppercase: true, market: "us" });
    const sa = normalizeGrouped(saRaw, { tickerUppercase: false, market: "sa" });
    const eg = normalizeGrouped(egRaw, { tickerUppercase: true, market: "eg" });

    return { us, sa, eg };
  })();

  return _catalogPromise;
}

export async function getStocks({ market = "us" } = {}) {
  const cat = await ensureCatalog();
  const m = market === "sa" ? "sa" : market === "eg" ? "eg" : "us";
  const pool = m === "sa" ? cat.sa : m === "eg" ? cat.eg : cat.us;

  return {
    market: m,
    count: pool.list.length,
    industries: pool.inds,
    items: pool.list,
  };
}

/** Returns all stocks from US, TASI, and EGX for unified search. */
export async function getAllStocks() {
  const cat = await ensureCatalog();
  const combined = [...cat.us.list, ...cat.sa.list, ...cat.eg.list];
  const industries = Array.from(new Set([...cat.us.inds, ...cat.sa.inds, ...cat.eg.inds])).sort((a, b) =>
    a.localeCompare(b)
  );
  return { items: combined, industries };
}

export async function getCompany(rawTicker) {
  const cat = await ensureCatalog();
  const up = String(rawTicker || "").toUpperCase();

  const hitUS = cat.us.byUpperTicker.get(up);
  if (hitUS) {
    return {
      ticker: hitUS.ticker,
      name: hitUS.name,
      market: "us",
      currency: CURRENCY_BY_MARKET.us,
    };
  }

  const hitSA = cat.sa.byUpperTicker.get(up);
  if (hitSA) {
    return {
      ticker: hitSA.ticker,
      name: hitSA.name,
      market: "sa",
      currency: CURRENCY_BY_MARKET.sa,
    };
  }

  const hitEG = cat.eg.byUpperTicker.get(up);
  if (hitEG) {
    return {
      ticker: hitEG.ticker,
      name: hitEG.name,
      market: "eg",
      currency: CURRENCY_BY_MARKET.eg,
    };
  }

  throw new Error("Ticker not found in supported stock lists.");
}

export async function resolveMarketAndSymbol(rawTicker, requestedMarket) {
  const cat = await ensureCatalog();

  const tickerUS = String(rawTicker || "").toUpperCase();
  const tickerSA = String(rawTicker || "");
  const tickerEG = normalizeEgxTicker(rawTicker);

  let market = requestedMarket === "sa" ? "sa" : requestedMarket === "eg" ? "eg" : requestedMarket === "us" ? "us" : null;

  if (!market) {
    if (cat.us.upperSet.has(tickerUS)) market = "us";
    else if (cat.sa.upperSet.has(tickerSA.toUpperCase())) market = "sa";
    else if (cat.eg.upperSet.has(tickerUS)) market = "eg";
  }
  if (!market) return { ok: false };

  const hitUS = cat.us.byUpperTicker.get(tickerUS);
  const hitSA = cat.sa.byUpperTicker.get(tickerSA.toUpperCase());
  const hitEG = cat.eg.byUpperTicker.get(tickerEG);
  const figi = market === "us" ? hitUS?.figi || null : market === "sa" ? hitSA?.figi || null : hitEG?.figi || null;

  // EGX endpoints in TwelveData are more reliable with bare ticker (without :EGX or .EGP).
  const symbol = market === "us" ? tickerUS : market === "sa" ? `${tickerSA}:TADAWUL` : tickerEG;
  const currency = CURRENCY_BY_MARKET[market];

  return { ok: true, market, symbol, tickerUS, tickerSA, tickerEG, figi, currency };
}

export function buildSymbolCandidates(resolved) {
  if (!resolved?.ok) return [];
  if (resolved.market === "eg") {
    return [
      resolved.symbol,
      `${resolved.tickerEG}:EGX`,
      `${resolved.tickerEG}.EGP`,
      resolved.figi,
    ].filter((v, i, a) => v && a.indexOf(v) === i);
  }
  if (resolved.market === "sa") {
    return [
      resolved.symbol,
      resolved.tickerSA,
      resolved.figi,
    ].filter((v, i, a) => v && a.indexOf(v) === i);
  }
  return [resolved.symbol, resolved.figi].filter((v, i, a) => v && a.indexOf(v) === i);
}
