import { getApiUrl } from "../config/env.js";
import { fetchWithRetry, readJsonResponse } from "../utils/apiFetch.js";

function parsePublishedDate(value) {
  if (!value) return null;
  const d = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Latest general market news via Express → FMP stable API (API key stays on server).
 */
export async function fetchGeneralMarketNews({ page = 0, limit = 20 } = {}) {
  const base = getApiUrl();
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const url = `${base}/api/fmp/news/general-latest?${qs}`;
  const res = await fetchWithRetry(url, { cache: "no-store", credentials: "omit" });
  const rows = await readJsonResponse(res, "Market news");
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      title: String(row?.title || "").trim(),
      url: String(row?.url || "").trim(),
      source: String(row?.publisher || "").trim(),
      date: parsePublishedDate(row?.publishedDate),
      image: row?.image || null,
      symbol: row?.symbol || null,
    }))
    .filter((a) => a.title && a.url);
}
