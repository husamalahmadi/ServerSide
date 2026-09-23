/**
 * Smoke test: stock SEO injection into index.html (no live server required).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { configureSeoSiteUrl } from "../shared/seo/siteUrl.js";
import { buildStockSeo } from "../shared/seo/structuredData.js";
import { legacyArabicStockRedirect, stockPath } from "../shared/seo/stockPaths.js";
import { findStockByTicker, CURRENCY_BY_MARKET } from "../server/stockCatalogLookup.js";
import { injectSeoIntoSpaHtml, buildStockStaticFallback } from "../server/spaHtmlSeo.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");const indexHtml = readFileSync(join(root, "server/static/index.html"), "utf8");
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
  const canonical = `https://trueprice.cash${stockPath(lang, found.hit.ticker)}`;
  return injectSeoIntoSpaHtml(indexHtml, seo, "https://trueprice.cash", canonical, {
    staticFallbackHtml: buildStockStaticFallback({
      hit: found.hit,
      market: found.market,
      lang,
      seo,
      currency: CURRENCY_BY_MARKET[found.market],
    }),
  });
}

for (const [ticker, lang] of [
  ["2222", "en"],
  ["AAPL", "en"],
  ["AAPL", "ar"],
]) {
  const html = renderStock(ticker, lang);
  const found = findStockByTicker(ticker);
  const canonical = `https://trueprice.cash${stockPath(lang, found.hit.ticker)}`;
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
  const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] || "";
  const hasLd = html.includes('"@type":"WebPage"') || html.includes('"@type": "WebPage"');
  console.log(`\n--- ${stockPath(lang, ticker)} ---`);
  const arAlt = html.match(/hreflang="ar" href="([^"]+)"/i)?.[1] || "";
  const canonicalHref = html.match(/rel="canonical" href="([^"]+)"/i)?.[1] || "";
  if (html.includes("?lang=")) throw new Error(`Query-string hreflang still present for ${ticker}`);
  if (!arAlt.endsWith(stockPath("ar", found.hit.ticker))) {
    throw new Error(`Arabic alternate missing for ${ticker}: ${arAlt}`);
  }
  if (canonicalHref !== canonical) throw new Error(`Canonical mismatch for ${ticker}: ${canonicalHref}`);
  console.log("title:", title.slice(0, 80));
  console.log("desc:", desc.slice(0, 100));
  console.log("jsonLd WebPage:", hasLd);
  const hasNarrative = html.includes("Valuation approach") || html.includes("منهجية التقييم");
  const wordApprox = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  console.log("narrative sections:", hasNarrative);
  console.log("approx word count:", wordApprox);
  if (!hasNarrative) throw new Error(`Missing narrative for ${ticker}`);
  if (wordApprox < 400) throw new Error(`Thin fallback HTML for ${ticker} (${wordApprox} words)`);
  if (!title || title.includes("Fair Value for US, TASI, Tokyo")) {
    throw new Error(`Generic title for ${ticker}`);
  }
  const ogImage = html.match(/property="og:image" content="([^"]+)"/i)?.[1] || "";
  const expectedOg = `https://trueprice.cash/og/${lang}/stock/${encodeURIComponent(found.hit.ticker)}.png`;
  if (ogImage !== expectedOg) throw new Error(`og:image mismatch for ${ticker}: ${ogImage}`);
  if (!html.includes('name="twitter:card" content="summary_large_image"')) {
    throw new Error(`Missing Twitter large card for ${ticker}`);
  }
}

if (legacyArabicStockRedirect("/stock/2222", "ar") !== "/ar/stock/2222") {
  throw new Error("Expected 301 target /ar/stock/2222");
}
if (legacyArabicStockRedirect("/stock/2222", "en") !== null) {
  throw new Error("English query must not redirect");
}
if (legacyArabicStockRedirect("/en/stock/2222", "ar") !== null) {
  throw new Error("Prefixed stock URL must not redirect");
}

console.log("\n[ok] stock SEO injection smoke test passed");
