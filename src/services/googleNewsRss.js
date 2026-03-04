/**
 * Fetches stock news from Google News RSS feed.
 * Uses a CORS proxy because news.google.com does not allow direct browser requests.
 */

const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

function buildRssUrl(ticker, companyName = "") {
  const parts = [ticker.trim()];
  if (companyName?.trim()) parts.push(companyName.trim());
  parts.push("stock");
  const query = encodeURIComponent(parts.join(" "));
  return `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

function parseRssXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const items = doc.querySelectorAll("item");
  const articles = [];

  for (const item of items) {
    const titleEl = item.querySelector("title");
    const linkEl = item.querySelector("link");
    const pubDateEl = item.querySelector("pubDate");
    const sourceEl = item.querySelector("source");

    const title = titleEl?.textContent?.trim() || "";
    const link = linkEl?.textContent?.trim() || "";
    const pubDateStr = pubDateEl?.textContent?.trim() || "";
    const source = sourceEl?.textContent?.trim() || "";

    let date = null;
    if (pubDateStr) {
      const d = new Date(pubDateStr);
      if (!Number.isNaN(d.getTime())) date = d;
    }

    if (title && link) {
      articles.push({ title, link, date, source });
    }
  }

  // Sort newest to oldest
  articles.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  return articles;
}

/**
 * Fetches news articles for a stock from Google News RSS.
 * @param {{ ticker: string, companyName?: string }} options
 * @returns {Promise<{ title: string, link: string, date: Date | null, source: string }[]>}
 */
async function fetchViaProxy(url) {
  let lastError = null;
  for (const toProxyUrl of CORS_PROXIES) {
    try {
      const res = await fetch(toProxyUrl(url), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text && text.trim().length > 0) return text;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("Failed to fetch news");
}

export async function fetchStockNews({ ticker, companyName = "" }) {
  if (!ticker || typeof ticker !== "string") return [];

  const rssUrl = buildRssUrl(ticker.trim(), String(companyName).trim());
  const text = await fetchViaProxy(rssUrl);
  return parseRssXml(text);
}
