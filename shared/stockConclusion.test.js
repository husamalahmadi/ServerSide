import test from "node:test";
import assert from "node:assert/strict";
import { assessFcf, buildStockConclusion, conclusionCopy, round2 } from "./stockConclusion.js";

function apple(overrides = {}) {
  return buildStockConclusion({
    price: 347.73,
    dcf: 138.51,
    fairEV: 257.74,
    fairPS: 255.46,
    fairPE: 255.56,
    equityPerShare: 4.93,
    roe: 1.519,
    totalEquity: 60_000_000_000,
    netIncome: 93_000_000_000,
    fcfSeries: [93, 111, 99, 108, 99],
    roic: 0.5197,
    wacc: 9.75,
    trends: { rev: true, op: true, net: true, fcf: true },
    netDebtToEbitda: 0.53,
    ...overrides,
  });
}

test("AAPL keeps four methods, drops equity, and uses the median", () => {
  const result = apple();
  const included = result.methods.filter((m) => m.included).map((m) => m.key);
  assert.deepEqual(included, ["dcf", "ev", "ps", "earnings"]);
  const equity = result.methods.find((m) => m.key === "equity");
  assert.equal(equity.included, false);
  assert.equal(equity.reason, "equity_roe");
  assert.equal(equity.value, 4.93);

  assert.equal(result.medianDisplay, 255.51);
  assert.equal(result.ratioDisplay, 1.36);
  assert.equal(result.premiumPct, 36);
  assert.equal(result.valuation, "overvalued");
  assert.equal(result.aboveCount, 0);
  assert.equal(result.applicableCount, 4);
  assert.equal(result.entryPrice, 217.18);
  assert.equal(result.fairValueToEnter, 409.09);

  const mean = round2((138.51 + 257.74 + 255.46 + 255.56) / 4);
  assert.notEqual(result.medianDisplay, mean);

  assert.equal(result.quality.pass, true);
  assert.equal(result.quality.score, 6);
  assert.equal(result.owners, "hold_dont_add");
  assert.equal(result.buyers, "wait");
  assert.equal(result.confidence.band, "low");
  assert.equal(result.confidence.spreadPct, 47);
});

test("AAPL copy is a two-line verdict with an entry price", () => {
  const copy = conclusionCopy(apple(), {
    company: "Apple",
    currency: "USD",
    earningsLabel: "Nov 2, 2026",
  });
  assert.equal(copy.verdict, "HOLD if you own it · WAIT if you don't");
  assert.match(copy.body, /Apple is a high-quality business/);
  assert.match(copy.body, /52%/);
  assert.match(copy.body, /9\.75%/);
  assert.match(copy.body, /36% above our median fair value of 255\.51 USD/);
  assert.match(copy.body, /none of our 4 applicable valuation methods support today's price/);
  assert.equal(copy.entry, "Entry zone: 217.18 USD or below.");
  assert.equal(copy.entryAlt, "Or fair value must rise to 409.09 USD at today's price.");
  assert.equal(copy.recheck, "Re-check: after earnings on Nov 2, 2026.");
  assert.equal(copy.confidence, "Confidence: Low, because the valuation methods disagree widely.");
  assert.match(copy.excluded, /ROE above 40%/);
});

test("valuation bands use 0.85 and 1.15", () => {
  const band = (price) =>
    buildStockConclusion({
      price,
      fairEV: 100,
      roic: 0.2,
      wacc: 8,
      trends: { rev: true, op: true, net: true, fcf: true },
      netDebtToEbitda: 0.2,
    }).valuation;
  assert.equal(band(85), "undervalued");
  assert.equal(band(85.01), "fair");
  assert.equal(band(115), "fair");
  assert.equal(band(115.01), "overvalued");
});

test("decision matrix covers owners and new buyers", () => {
  const base = {
    fairEV: 100,
    roic: 0.2,
    wacc: 8,
    trends: { rev: true, op: true, net: true, fcf: true },
    netDebtToEbitda: 0.2,
  };
  const at = (price, extra = {}) => buildStockConclusion({ ...base, price, ...extra });
  assert.deepEqual([at(70).owners, at(70).buyers], ["invest_add", "invest"]);
  assert.deepEqual([at(100).owners, at(100).buyers], ["hold", "wait"]);
  assert.deepEqual([at(140).owners, at(140).buyers], ["hold_dont_add", "wait"]);
  const trap = at(70, { roic: 0.02, wacc: 9 });
  assert.equal(trap.quality.pass, false);
  assert.deepEqual([trap.owners, trap.buyers], ["hold_review", "wait_trap"]);
});

test("quality fails when ROIC does not beat WACC, even at 5 of 6", () => {
  const result = buildStockConclusion({
    price: 80,
    fairEV: 100,
    roic: 0.05,
    wacc: 9.75,
    trends: { rev: true, op: true, net: true, fcf: true },
    netDebtToEbitda: 0.4,
  });
  assert.equal(result.quality.score, 5);
  assert.equal(result.quality.roicPass, false);
  assert.equal(result.quality.pass, false);
});

test("quality passes at 5 of 6 when ROIC still beats WACC", () => {
  const result = buildStockConclusion({
    price: 80,
    fairEV: 100,
    roic: 0.2,
    wacc: 8,
    trends: { rev: true, op: false, net: true, fcf: true },
    netDebtToEbitda: 0.4,
  });
  assert.equal(result.quality.score, 5);
  assert.equal(result.quality.pass, true);
  assert.equal(result.owners, "invest_add");
});

test("net debt of 3 does not pass", () => {
  const fail = buildStockConclusion({ price: 80, fairEV: 100, netDebtToEbitda: 3, trends: {} });
  const pass = buildStockConclusion({ price: 80, fairEV: 100, netDebtToEbitda: 2.99, trends: {} });
  assert.equal(fail.quality.checks.find((c) => c.key === "debt").met, false);
  assert.equal(pass.quality.checks.find((c) => c.key === "debt").met, true);
});

test("equity is excluded for ROE above 40% or negative book value", () => {
  const kept = buildStockConclusion({ price: 10, equityPerShare: 8, roe: 0.4, totalEquity: 100 });
  const ratio = buildStockConclusion({ price: 10, equityPerShare: 4.93, roe: 0.41, totalEquity: 100 });
  const percent = buildStockConclusion({ price: 10, equityPerShare: 4.93, roe: 41, totalEquity: 100 });
  const negative = buildStockConclusion({ price: 10, equityPerShare: 4, roe: 0.1, totalEquity: -5 });
  assert.equal(kept.methods.find((m) => m.key === "equity").included, true);
  assert.equal(ratio.methods.find((m) => m.key === "equity").reason, "equity_roe");
  assert.equal(percent.methods.find((m) => m.key === "equity").reason, "equity_roe");
  assert.equal(negative.methods.find((m) => m.key === "equity").reason, "equity_negative");
});

test("equity stays out of the median until ROE has been checked", () => {
  const result = buildStockConclusion({
    price: 100,
    fairEV: 100,
    equityPerShare: 4,
    equitySettled: false,
    totalEquity: 10,
  });
  const equity = result.methods.find((m) => m.key === "equity");
  assert.equal(equity.pending, true);
  assert.equal(equity.included, false);
  assert.equal(equity.reason, null);
  assert.equal(result.applicableCount, 1);
});

test("DCF is excluded for negative or erratic free cash flow", () => {
  assert.equal(assessFcf([93, 111, 99, 108, 99]).exclude, false);
  assert.equal(assessFcf([100, 70, 90, 100]).reason, null);
  assert.equal(assessFcf([100, 70, 100, 70]).reason, "fcf_erratic");
  assert.equal(assessFcf([100, 80, -5]).reason, "fcf_negative");

  const negative = buildStockConclusion({ price: 50, dcf: 40, fairEV: 50, fcfSeries: [10, -2] });
  assert.equal(negative.methods.find((m) => m.key === "dcf").reason, "fcf_negative");
  assert.equal(negative.methods.find((m) => m.key === "dcf").included, false);

  const pending = buildStockConclusion({
    price: 50,
    dcf: 40,
    fcfSeries: [10, -2],
    fcfSettled: false,
  });
  assert.equal(pending.methods.find((m) => m.key === "dcf").pending, true);
  assert.equal(pending.methods.find((m) => m.key === "dcf").reason, null);
});

test("earnings fair value is excluded when net income is negative", () => {
  const result = buildStockConclusion({ price: 20, fairPE: 15, fairEV: 22, netIncome: -5 });
  const earnings = result.methods.find((m) => m.key === "earnings");
  assert.equal(earnings.included, false);
  assert.equal(earnings.reason, "earnings_negative");
  assert.equal(result.methods.find((m) => m.key === "ev").included, true);
});

test("confidence bands are high under 20%, medium through 40%, low above", () => {
  const band = (fairPS) =>
    buildStockConclusion({ price: 100, fairEV: 100, fairPS }).confidence;
  assert.equal(band(119).band, "high");
  assert.equal(band(130).band, "medium");
  assert.equal(band(150).spreadPct, 40);
  assert.equal(band(150).band, "medium");
  assert.equal(band(160).band, "low");
  const single = buildStockConclusion({ price: 100, fairEV: 100 }).confidence;
  assert.equal(single.band, "high");
  assert.equal(single.single, true);
});
