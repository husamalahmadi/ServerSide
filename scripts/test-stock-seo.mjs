/**
 * Smoke test: stock SEO injection into index.html (no live server required).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { configureSeoSiteUrl } from "../shared/seo/siteUrl.js";
import { buildStockSeo } from "../shared/seo/structuredData.js";
import { findStockByTicker, CURRENCY_BY_MARKET } from "../server/stockCatalogLookup.js";
import { injectSeoIntoSpaHtml, buildStockStaticFallback } from "../server/spaHtmlSeo.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(root, "server/static/index.html"), "utf8");
configureSeoSiteUrl("https://trueprice.cash");

function renderStock(ticker, lang = "en") {
  const found = findStockByTicker(ticker);
  if (!found) throw new Error(`Ticker not found: ${ticker}`);
  const seo = buildStockSeo({
    ticker: found.hit.ticker,
    companyName: found.hit.name,
    lang,
    market: found.market,
    currency: CURRENCY_BY_MARKET[found.market],
  });
  const canonical = `https://trueprice.cash/stock/${encodeURIComponent(found.hit.ticker)}`;
  return injectSeoIntoSpaHtml(indexHtml, seo, "https://trueprice.cash", canonical, {
    staticFallbackHtml: buildStockStaticFallback({
      hit: found.hit,
      market: found.market,
      lang,
      seo,
    }),
  });
}

for (const [ticker, lang] of [
  ["2222", "en"],
  ["AAPL", "en"],
  ["AAPL", "ar"],
]) {
  const html = renderStock(ticker, lang);
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
  const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] || "";
  const hasLd = html.includes('"@type":"WebPage"') || html.includes('"@type": "WebPage"');
  const fallback = html.includes("tp-static-fallback") && !html.includes("Fair value for US, TASI");
  console.log(`\n--- /stock/${ticker}?lang=${lang} ---`);
  console.log("title:", title.slice(0, 80));
  console.log("desc:", desc.slice(0, 100));
  console.log("jsonLd WebPage:", hasLd);
  console.log("custom fallback:", fallback);
  if (!title || title.includes("Fair Value for US, TASI, Tokyo")) {
    throw new Error(`Generic title for ${ticker}`);
  }
}

console.log("\n[ok] stock SEO injection smoke test passed");
