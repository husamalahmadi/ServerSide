import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { absoluteCanonicalUrl, canonicalPathname } from "./canonicalUrl.js";
import { canonicalStockRedirect, stockRequestAction } from "./stockPaths.js";
import { EARNINGS_CALENDAR_PATH, UNDERVALUED_PATH, sectorPath } from "../tasiProgrammatic.js";

const SITE = "https://www.trueprice.cash";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("homepage keeps one trailing slash and other paths do not", () => {
  assert.equal(absoluteCanonicalUrl(SITE, "/"), `${SITE}/`);
  assert.equal(absoluteCanonicalUrl(SITE, "/us-markets/"), `${SITE}/us-markets`);
  assert.equal(absoluteCanonicalUrl(SITE, "/en/blogs/"), `${SITE}/en/blogs`);
  assert.equal(canonicalPathname("/en/stock/AAPL/"), "/en/stock/AAPL");
});

test("arabic sitemap paths stay percent-encoded and are not double-encoded", () => {
  const undervalued = absoluteCanonicalUrl(SITE, UNDERVALUED_PATH);
  const earnings = absoluteCanonicalUrl(SITE, EARNINGS_CALENDAR_PATH);
  const banks = absoluteCanonicalUrl(SITE, sectorPath("البنوك"));
  assert.equal(undervalued, `${SITE}${encodeURI(UNDERVALUED_PATH)}`);
  assert.equal(earnings, `${SITE}${encodeURI(EARNINGS_CALENDAR_PATH)}`);
  assert.equal(banks, `${SITE}${encodeURI(sectorPath("البنوك"))}`);
  assert.equal(absoluteCanonicalUrl(SITE, undervalued), undervalued);
  assert.equal(canonicalPathname(canonicalPathname(UNDERVALUED_PATH)), canonicalPathname(UNDERVALUED_PATH));
});

test("published sitemap locs match the canonical URL helper", () => {
  const xml = readFileSync(join(root, "public", "sitemap-tasi.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(locs.length > 20);
  for (const loc of locs) {
    assert.equal(absoluteCanonicalUrl(SITE, loc), loc);
  }
});

test("stock aliases redirect to the catalog symbol", () => {
  assert.equal(canonicalStockRedirect("/en/stock/BRK.B", "", "BRK-B"), "/en/stock/BRK-B");
  assert.equal(canonicalStockRedirect("/en/stock/BRK-B", "", "BRK-B"), null);
  assert.equal(canonicalStockRedirect("/stock/AAPL", "ar", "AAPL"), "/ar/stock/AAPL");
  assert.equal(canonicalStockRedirect("/en/stock/2222", "", "2222"), null);
});

test("unresolved stock URLs are gone on the crawled URL", () => {
  assert.deepEqual(stockRequestAction("/stock/www.tcw.com", "en", null), { type: "gone" });
  assert.deepEqual(stockRequestAction("/stock/www.sv-ac.com", "", null), { type: "gone" });
  assert.deepEqual(stockRequestAction("/stock/0P0000RP9B", "en", null), { type: "gone" });
  assert.deepEqual(stockRequestAction("/en/stock/0P0000IC0E.T", "", null), { type: "gone" });
  assert.deepEqual(stockRequestAction("/stock/0P1000TC5L", "en", null), { type: "gone" });
});

test("resolved legacy stock URLs redirect once", () => {
  assert.deepEqual(stockRequestAction("/stock/151A.T", "", "151A.T"), {
    type: "redirect",
    target: "/en/stock/151A.T",
  });
  assert.deepEqual(stockRequestAction("/en/stock/151A.T", "", "151A.T"), { type: "continue" });
  assert.deepEqual(stockRequestAction("/stock/AAPL", "ar", "AAPL"), {
    type: "redirect",
    target: "/ar/stock/AAPL",
  });
});
