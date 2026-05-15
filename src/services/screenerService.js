import { publicUrl } from "../utils/publicUrl.js";
import { collectScreenerItems } from "../domain/screenerMetrics.js";

const SCREENER_US_URL = publicUrl("data/screener_us.json");
const SCREENER_SA_URL = publicUrl("data/screener_sa.json");
const SP500_DATA_URL = publicUrl("data/sp500_financial_data.json");
const TASI_DATA_URL = publicUrl("data/tasi_financial_data.json");

let _screenerPromise = null;

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  return res.json();
}

function itemsFromScreenerPayload(json, market) {
  const items = json?.items;
  if (!Array.isArray(items)) return null;
  return items.map((row) => ({
    ...row,
    market: row.market || market,
    ticker: market === "us" ? String(row.ticker || "").toUpperCase() : String(row.ticker || ""),
  }));
}

async function loadMarketItems(screenerUrl, fullDataUrl, market) {
  try {
    const compact = await fetchJson(screenerUrl);
    const fromCompact = itemsFromScreenerPayload(compact, market);
    if (fromCompact?.length) return fromCompact;
  } catch {
    /* fall back to full financial dump */
  }
  const full = await fetchJson(fullDataUrl);
  return collectScreenerItems(full, market);
}

export async function getScreenerDataset() {
  if (_screenerPromise) return _screenerPromise;
  _screenerPromise = (async () => {
    try {
      const [us, sa] = await Promise.all([
        loadMarketItems(SCREENER_US_URL, SP500_DATA_URL, "us"),
        loadMarketItems(SCREENER_SA_URL, TASI_DATA_URL, "sa"),
      ]);
      const items = [...us, ...sa];
      const sectors = Array.from(new Set(items.map((x) => x.sector).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      );
      return { items, sectors };
    } catch (err) {
      _screenerPromise = null;
      throw err;
    }
  })();
  return _screenerPromise;
}
