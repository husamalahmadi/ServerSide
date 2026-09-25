// Scores insider-trading evidence for one ticker. Pure function, no I/O.
// Port of the reference module (lib/insiderSignal.ts) for this JavaScript codebase.

/** @typedef {{ symbol: string, filingDate?: string, transactionDate: string, reportingCik?: string, reportingName: string, typeOfOwner?: string, transactionType: string, securitiesTransacted: number, securitiesOwned: number, price: number, url?: string }} InsiderTrade */
/** @typedef {{ year: number, quarter: number, totalPurchases: number, totalSales: number, totalAcquired: number, totalDisposed: number }} InsiderQuarter */
/** @typedef {{ date: string, price: number }} PricePoint */

const DAY = 86_400_000;
const isoDaysAgo = (now, n) => new Date(now.getTime() - n * DAY).toISOString().slice(0, 10);
const insiderId = (t) => t.reportingCik || t.reportingName;
export const tradeKey = (t) =>
  [t.reportingCik, t.transactionDate, t.transactionType, t.securitiesTransacted, t.price, t.securitiesOwned].join("|");

/** Routine = same insider bought in the same calendar month in >= 2 earlier years (Cohen, Malloy & Pomorski 2012). */
export function isRoutine(trade, allBuys) {
  const y = Number(trade.transactionDate.slice(0, 4));
  const m = trade.transactionDate.slice(5, 7);
  const years = new Set(
    allBuys
      .filter((b) => insiderId(b) === insiderId(trade) && Number(b.transactionDate.slice(0, 4)) < y && b.transactionDate.slice(5, 7) === m)
      .map((b) => b.transactionDate.slice(0, 4)),
  );
  return years.size >= 2;
}

function drawdownFrom52wHigh(prices, date) {
  const start = new Date(new Date(date).getTime() - 365 * DAY).toISOString().slice(0, 10);
  let hi = null, cur = null;
  for (const p of prices) {
    if (p.date >= start && p.date <= date) {
      hi = hi === null ? p.price : Math.max(hi, p.price);
      cur = p.price;
    }
  }
  return hi && cur ? (1 - cur / hi) * 100 : null;
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export function scoreInsiderSignal(input) {
  const now = input.now ?? new Date();
  const cut90 = isoDaysAgo(now, 90);
  const recent = input.buys.filter((b) => b.transactionDate >= cut90);
  const buyers = [...new Set(recent.map(insiderId))];
  const nB = buyers.length;
  const checks = [];
  const flags = [];

  const c1 = nB >= 3 ? 30 : nB === 2 ? 20 : nB === 1 ? 10 : 0;
  checks.push({
    id: "cluster",
    name: "Cluster buying",
    points: c1,
    max: 30,
    status: c1 >= 30 ? "pass" : c1 > 0 ? "partial" : "fail",
    detail: nB
      ? `${nB} distinct insider${nB > 1 ? "s" : ""} bought on the open market in the last 90 days.`
      : "No open-market insider purchases in the last 90 days.",
  });

  const routineBuyKeys = input.buys.filter((b) => isRoutine(b, input.buys)).map(tradeKey);
  const routineSet = new Set(routineBuyKeys);
  const oppByBuyer = new Map();
  for (const b of recent) oppByBuyer.set(insiderId(b), (oppByBuyer.get(insiderId(b)) ?? false) || !routineSet.has(tradeKey(b)));
  const opp = [...oppByBuyer.values()].filter(Boolean).length;
  const c2 = !nB ? 0 : opp === nB ? 15 : opp > 0 ? 8 : 0;
  checks.push({
    id: "opportunistic",
    name: "Opportunistic, not routine",
    points: c2,
    max: 15,
    status: !nB ? "fail" : c2 === 15 ? "pass" : c2 > 0 ? "partial" : "fail",
    detail: nB ? `${opp} of ${nB} recent buyers broke from their usual calendar pattern.` : "Nothing to classify.",
  });

  let maxPct = 0, totalUsd = 0;
  for (const b of recent) {
    const sh = b.securitiesTransacted || 0;
    const before = (b.securitiesOwned || 0) - sh;
    totalUsd += sh * (b.price || 0);
    maxPct = Math.max(maxPct, before > 0 ? (sh / before) * 100 : sh > 0 ? 100 : 0);
  }
  let c3 = 0;
  if (recent.length) {
    c3 = maxPct >= 20 ? 15 : maxPct >= 5 ? 8 : 3;
    if (totalUsd >= 1e6) c3 = Math.min(15, c3 + 5);
  }
  checks.push({
    id: "size",
    name: "Conviction size",
    points: c3,
    max: 15,
    status: !recent.length ? "fail" : c3 >= 15 ? "pass" : "partial",
    detail: recent.length
      ? `Largest buy added ${maxPct.toFixed(0)}% to that insider's holding; total bought $${Math.round(totalUsd).toLocaleString("en-US")}.`
      : "No recent purchases to size.",
  });

  const dds = recent.map((b) => drawdownFrom52wHigh(input.prices, b.transactionDate)).filter((x) => x !== null);
  const avgDD = dds.length ? dds.reduce((a, b) => a + b, 0) / dds.length : null;
  const c4 = avgDD === null ? 0 : avgDD >= 20 ? 15 : avgDD >= 10 ? 8 : 0;
  checks.push({
    id: "weakness",
    name: "Buying into weakness",
    points: c4,
    max: 15,
    status: c4 >= 15 ? "pass" : c4 > 0 ? "partial" : "fail",
    detail: avgDD !== null
      ? `Buys came on average ${avgDD.toFixed(0)}% below the trailing 52-week high.`
      : recent.length
        ? "Price history unavailable for the buy dates."
        : "No recent purchases to time.",
  });

  const q = [...input.quarters].sort((a, b) => b.year - a.year || b.quarter - a.quarter);
  const P2 = q.slice(0, 2).reduce((s, r) => s + (r.totalPurchases || 0), 0);
  const S2 = q.slice(0, 2).reduce((s, r) => s + (r.totalSales || 0), 0);
  const npr = P2 + S2 > 0 ? (P2 - S2) / (P2 + S2) : null;
  const c5 = npr === null ? 0 : npr > 0.5 ? 25 : npr > 0 ? 15 : npr > -0.5 ? 5 : 0;
  checks.push({
    id: "npr",
    name: "Net purchase ratio",
    points: c5,
    max: 25,
    status: c5 >= 25 ? "pass" : c5 > 0 ? "partial" : "fail",
    detail: npr !== null
      ? `NPR ${npr.toFixed(2)} (${P2} purchases vs ${S2} sales over the last two quarters).`
      : "No open-market transactions in the last two quarters.",
  });

  if (q.length >= 3) {
    const cur = q[0].totalSales || 0;
    const prior = q.slice(1, 5).map((r) => r.totalSales || 0);
    const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
    if (cur >= 10 && avg > 0 && cur >= 2 * avg) {
      flags.push({
        id: "SELLING_PACE",
        label: "Selling above usual pace",
        detail: `Open-market sales this quarter (${cur}) are ${(cur / avg).toFixed(1)}x the average of the prior ${prior.length} quarters. Selling has little predictive power on its own.`,
      });
    }
  }

  const cut120 = isoDaysAgo(now, 120);
  const awardByInsider = new Map();
  for (const a of input.awards.filter((a) => a.transactionDate >= cut120 && a.transactionType.startsWith("A"))) {
    const k = insiderId(a);
    const e = awardByInsider.get(k) ?? { name: a.reportingName, shares: 0 };
    e.shares += a.securitiesTransacted || 0;
    awardByInsider.set(k, e);
  }
  const baseline = median(q.slice(1, 9).map((r) => r.totalAcquired || 0));
  for (const { name, shares } of awardByInsider.values()) {
    if (baseline > 0 && shares >= 5 * baseline) {
      flags.push({
        id: "MEGA_GRANT",
        label: "Unusually large stock award",
        detail: `${name} received ${shares.toLocaleString("en-US")} shares/units in awards, ${(shares / baseline).toFixed(0)}x the typical quarterly amount. Research links award timing to upcoming company news (Yermack 1997), but this is a board decision, not an insider purchase.`,
      });
      break;
    }
  }

  const score = checks.reduce((s, c) => s + c.points, 0);
  const verdict = score >= 60 ? "Strong insider buying signal" : score >= 35 ? "Moderate buying signal" : score >= 15 ? "Weak signal" : "No insider buying signal";
  const buys12 = input.buys.filter((b) => b.transactionDate >= isoDaysAgo(now, 365)).length;
  const summary = !buys12
    ? "No open-market insider purchases in the past 12 months. Insiders here receive stock through grants and sell it, which is normal for large caps and says nothing either way about future returns."
    : verdict === "Strong insider buying signal"
      ? "Several insiders are buying with their own money in the pattern that has historically been informative. Confirm with fundamentals."
      : verdict === "Moderate buying signal"
        ? "Some real insider buying, but not the full pattern. Check who is buying and how much it adds to their stake."
        : "Insider buying exists but is thin, routine or small, so it adds little information.";

  return { score, verdict, summary, checks, flags, routineBuyKeys };
}
