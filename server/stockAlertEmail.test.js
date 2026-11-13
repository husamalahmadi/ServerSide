import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStockAlertEmail, stockAlertSubject, stockChangeNarrative } from "./stockAlertEmail.js";

const flipToOver = {
  ticker: "AAPL",
  name: "Apple Inc.",
  currency: "USD",
  since: "2026-11-03T12:00:00.000Z",
  priceFrom: 180,
  priceTo: 198,
  priceMove: 0.1,
  fvFrom: 190,
  fvTo: 189,
  fvMove: -1 / 190,
  verdictThen: "undervalued",
  verdictNow: "overvalued",
  flipped: true,
  priceMoved: true,
  fvMoved: false,
};

const fvCut = {
  ticker: "2222",
  name: "Saudi Aramco",
  currency: "SAR",
  since: null,
  priceFrom: 27,
  priceTo: 27.1,
  priceMove: 0.1 / 27,
  fvFrom: 40,
  fvTo: 36,
  fvMove: -0.1,
  verdictThen: "undervalued",
  verdictNow: "undervalued",
  flipped: false,
  priceMoved: false,
  fvMoved: true,
};

test("narrative tells the price move, fair value, and the verdict flip", () => {
  const text = stockChangeNarrative(flipToOver, "en");
  assert.match(text, /^Since you last looked at Apple Inc\. \(AAPL\) on November 3, 2026, /);
  assert.match(text, /share price has risen 10\.0%, from 180\.00 USD to 198\.00 USD\./);
  assert.match(text, /fair value estimate is unchanged at 189\.00 USD\./);
  assert.match(text, /gone from undervalued to overvalued/);
  assert.match(text, /about 4\.8% above our fair value/);
});

test("narrative without a baseline date still reads as a sentence", () => {
  const text = stockChangeNarrative(fvCut, "en");
  assert.match(text, /^Since you last looked at Saudi Aramco \(2222\), its share price/);
  assert.match(text, /revised down 10\.0%, from 40\.00 SAR to 36\.00 SAR/);
  assert.match(text, /still looks undervalued/);
});

test("narrative without a price makes fair value the main clause", () => {
  const text = stockChangeNarrative({ ...fvCut, priceTo: null, priceFrom: null, priceMove: null, verdictNow: null }, "en");
  assert.equal(
    text,
    "Since you last looked at Saudi Aramco (2222), our fair value estimate was revised down 10.0%, from 40.00 SAR to 36.00 SAR."
  );
});

test("subject names what changed and leads with the biggest change", () => {
  assert.equal(stockAlertSubject([flipToOver], "en"), "Apple Inc. (AAPL): now overvalued, price up 10.0%");
  assert.equal(
    stockAlertSubject([fvCut, flipToOver], "en"),
    "Apple Inc. (AAPL): now overvalued, price up 10.0% — plus 1 more stock you viewed"
  );
  assert.match(stockAlertSubject([fvCut], "ar"), /انخفاض القيمة العادلة 10\.0%/);
});

test("email renders one language with links and an unsubscribe for this kind", () => {
  const { subject, html, text } = buildStockAlertEmail({
    lang: "ar",
    changes: [flipToOver, fvCut],
    siteUrl: "https://www.trueprice.cash/",
    unsubscribeUrl: "https://www.trueprice.cash/api/email/unsubscribe?kind=stock&token=abc",
  });
  assert.ok(subject.includes("AAPL"));
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes("https://www.trueprice.cash/ar/stock/AAPL"));
  assert.ok(html.includes("kind=stock&amp;token=abc"));
  assert.ok(!html.includes("Since you last looked"));
  assert.ok(text.includes("https://www.trueprice.cash/profile"));
});
