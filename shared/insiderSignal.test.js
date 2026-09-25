import test from "node:test";
import assert from "node:assert/strict";
import { isRoutine, scoreInsiderSignal, tradeKey } from "./insiderSignal.js";

const NOW = new Date("2026-03-20T12:00:00.000Z");

function buy(partial) {
  return {
    symbol: "TEST",
    reportingName: "Ada Insider",
    reportingCik: "0001",
    transactionType: "P-Purchase",
    securitiesTransacted: 1000,
    securitiesOwned: 5000,
    price: 20,
    transactionDate: "2026-03-01",
    ...partial,
  };
}

function quarter(year, quarterNum, extra = {}) {
  return {
    year,
    quarter: quarterNum,
    totalPurchases: 0,
    totalSales: 0,
    totalAcquired: 200_000,
    totalDisposed: 0,
    ...extra,
  };
}

test("no buys and heavy sales stays at or below 10 and flags selling pace", () => {
  const result = scoreInsiderSignal({
    now: NOW,
    buys: [],
    sells: [buy({ transactionType: "S-Sale", transactionDate: "2026-02-01", securitiesTransacted: 5000 })],
    awards: [],
    prices: [{ date: "2026-02-01", price: 40 }],
    quarters: [
      quarter(2026, 1, { totalSales: 40, totalPurchases: 0 }),
      quarter(2025, 4, { totalSales: 10 }),
      quarter(2025, 3, { totalSales: 8 }),
      quarter(2025, 2, { totalSales: 6 }),
    ],
  });
  assert.ok(result.score <= 10);
  assert.equal(result.verdict, "No insider buying signal");
  assert.ok(result.flags.some((f) => f.id === "SELLING_PACE"));
});

test("three opportunistic buyers 25% below the high with a strong NPR score at least 60", () => {
  const buys = ["0001", "0002", "0003"].map((cik, i) =>
    buy({
      reportingCik: cik,
      reportingName: `Buyer ${i + 1}`,
      transactionDate: "2026-03-02",
      securitiesTransacted: 2000,
      securitiesOwned: 6000,
      price: 75,
    }),
  );
  const prices = [
    { date: "2025-06-01", price: 100 },
    { date: "2026-03-02", price: 75 },
  ];
  const result = scoreInsiderSignal({
    now: NOW,
    buys,
    sells: [],
    awards: [],
    prices,
    quarters: [
      quarter(2026, 1, { totalPurchases: 8, totalSales: 1 }),
      quarter(2025, 4, { totalPurchases: 6, totalSales: 1 }),
    ],
  });
  assert.ok(result.score >= 60, `expected >= 60, got ${result.score}`);
  assert.equal(result.checks.find((c) => c.id === "cluster").points, 30);
  assert.equal(result.checks.find((c) => c.id === "npr").points, 25);
});

test("a Hut 8-like mega grant flags without changing the score", () => {
  const base = {
    now: NOW,
    buys: [],
    sells: [],
    prices: [],
    quarters: [
      quarter(2026, 1, { totalAcquired: 200_000 }),
      quarter(2025, 4, { totalAcquired: 180_000 }),
      quarter(2025, 3, { totalAcquired: 220_000 }),
      quarter(2025, 2, { totalAcquired: 200_000 }),
    ],
  };
  const award = buy({
    transactionType: "A-Award",
    reportingName: "CEO Grant",
    reportingCik: "0009",
    transactionDate: "2026-02-15",
    securitiesTransacted: 3_350_850,
    securitiesOwned: 3_350_850,
    price: 0,
  });
  const without = scoreInsiderSignal({ ...base, awards: [] });
  const withGrant = scoreInsiderSignal({ ...base, awards: [award] });
  assert.equal(withGrant.score, without.score);
  assert.ok(withGrant.flags.some((f) => f.id === "MEGA_GRANT"));
  assert.equal(without.flags.some((f) => f.id === "MEGA_GRANT"), false);
});

test("March buys in 2023 and 2024 tag a March 2026 buy as routine", () => {
  const march2026 = buy({ transactionDate: "2026-03-10", reportingCik: "0007", reportingName: "Repeat Buyer" });
  const history = [
    buy({ transactionDate: "2023-03-12", reportingCik: "0007", reportingName: "Repeat Buyer" }),
    buy({ transactionDate: "2024-03-08", reportingCik: "0007", reportingName: "Repeat Buyer" }),
    march2026,
  ];
  assert.equal(isRoutine(march2026, history), true);
  const result = scoreInsiderSignal({
    now: NOW,
    buys: history,
    sells: [],
    awards: [],
    prices: [{ date: "2025-04-01", price: 10 }, { date: "2026-03-10", price: 10 }],
    quarters: [quarter(2026, 1, { totalPurchases: 1 })],
  });
  assert.ok(result.routineBuyKeys.includes(tradeKey(march2026)));
});
