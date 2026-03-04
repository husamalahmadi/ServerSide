/**
 * Fetches stock news from Google News RSS feed.
 * Uses same-origin proxy (Vercel) or CORS proxies because news.google.com blocks direct browser requests.
 */

function getProxyUrls(targetUrl) {
  const encoded = encodeURIComponent(targetUrl);
  return [
    () => `https://api.cors.syrins.tech/?url=${encoded}`,
    () => `https://api.allorigins.win/get?url=${encoded}`,
    () => `https://api.allorigins.win/raw?url=${encoded}`,
    () => `https://corsproxy.io/?url=${encoded}`,
    () => `${typeof window !== "undefined" ? window.location.origin : ""}/api/proxy-rss?url=${encoded}`,
  ];
}

function buildRssUrl(ticker) {
  const query = encodeURIComponent(`${ticker.trim()} stock`);
  return `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

function parseRssXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const items = doc.getElementsByTagName("item");
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

  if (articles.length === 0 && xmlText.includes("<item>")) {
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const titleRegex = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([^<]*)<\/title>/i;
    const linkRegex = /<link>([^<]*)<\/link>/i;
    let match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const block = match[1];
      const titleMatch = block.match(titleRegex);
      const linkMatch = block.match(linkRegex);
      const title = titleMatch ? (titleMatch[1] || titleMatch[2] || "").trim() : "";
      const link = linkMatch ? linkMatch[1].trim() : "";
      if (title && link && !title.includes("Google News")) {
        articles.push({ title, link, date: null, source: "" });
      }
    }
  }

  articles.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  return articles;
}

/**
 * Fetches news articles for a stock from Google News RSS.
 * @param {{ ticker: string, companyName?: string }} options
 * @returns {Promise<{ title: string, link: string, date: Date | null, source: string }[]>}
 */
async function fetchViaProxy(url) {
  const proxies = getProxyUrls(url);
  let lastError = null;
  for (const getProxyUrl of proxies) {
    try {
      const proxyUrl = getProxyUrl();
      if (!proxyUrl.startsWith("http")) continue;
      const res = await fetch(proxyUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let text = await res.text();
      if (proxyUrl.includes("allorigins.win/get")) {
        try {
          const json = JSON.parse(text);
          text = json?.contents ?? "";
        } catch {
          /* use raw text */
        }
      }
      if (text && text.trim().length > 0) return text;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("Failed to fetch news");
}

export async function fetchStockNews({ ticker, companyName = "" }) {
  if (!ticker || typeof ticker !== "string") return [];

  const rssUrl = buildRssUrl(ticker.trim());
  const text = await fetchViaProxy(rssUrl);
  return parseRssXml(text);
}
