import {
  buildYearlyEvFairValue,
  computeEvFairValuePerShare,
  aggregateMonthlyPrices,
} from "../shared/evFairValue.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const yearly = buildYearlyEvFairValue({
  keyMetrics: [
    { fiscalYear: 2022, date: "2022-12-31", enterpriseValue: 2_000_000_000_000 },
    { fiscalYear: 2023, date: "2023-12-31", enterpriseValue: 2_500_000_000_000 },
  ],
  balanceSheet: [
    { fiscalYear: 2022, cashAndCashEquivalents: 50_000_000_000, totalDebt: 120_000_000_000, commonStock: 15_000_000_000 },
    { fiscalYear: 2023, cashAndCashEquivalents: 60_000_000_000, totalDebt: 110_000_000_000, commonStock: 15_500_000_000 },
  ],
  enterpriseValues: [],
  incomeStatement: [],
});

assert(yearly.length === 2, "expected 2 yearly rows");
assert(yearly[0].fairValue > 0, "fair value positive");
assert(
  computeEvFairValuePerShare({ enterpriseValue: 100, cash: 20, debt: 30, shares: 10 }) === 9,
  "formula (EV + cash - debt) / shares"
);

const monthly = aggregateMonthlyPrices([
  { date: "2024-01-05", price: 100 },
  { date: "2024-01-20", price: 105 },
  { date: "2024-02-10", price: 110 },
]);
assert(monthly.length === 2, "monthly aggregation");
assert(monthly[0].date === "2024-01-20", "last day in month wins");

console.log("evFairValue tests passed");
