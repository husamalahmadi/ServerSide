/** @param {unknown} v */
export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Shares denominator per spec (`commonStock` from balance sheet) with sane fallbacks
 * when FMP reports book equity instead of share count.
 */
export function sharesDenominator(balanceRow, evRow, incomeRow) {
  const cs = num(balanceRow?.commonStock);
  if (cs != null && cs >= 1e4 && cs <= 1e12) return cs;
  return (
    num(evRow?.numberOfShares) ??
    num(incomeRow?.weightedAverageShsOut) ??
    num(incomeRow?.weightedAverageShsOutDil)
  );
}

/**
 * Fair value per share = (Enterprise Value + cash − debt) / shares.
 * Matches the enterprise-value approach used across TruePrice.
 */
export function computeEvFairValuePerShare({ enterpriseValue, cash, debt, shares }) {
  const ev = num(enterpriseValue);
  const sh = num(shares);
  if (ev == null || sh == null || sh <= 0) return null;
  const fv = (ev + (num(cash) ?? 0) - (num(debt) ?? 0)) / sh;
  return fv > 0 && Number.isFinite(fv) ? fv : null;
}

function fiscalYearFromRow(row) {
  if (!row || typeof row !== "object") return null;
  const fy = num(row.fiscalYear);
  if (fy != null) return fy;
  const d = String(row.date || row.calendarYear || "").trim();
  if (!d) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function upsertYear(map, year, patch) {
  const prev = map.get(year) || { year };
  map.set(year, { ...prev, ...patch, year });
}

/**
 * Build yearly EV-based fair value from FMP key-metrics, balance sheet, EV, and income rows.
 * @returns {{ year: number, date: string|null, fairValue: number }[]}
 */
export function buildYearlyEvFairValue({
  keyMetrics = [],
  balanceSheet = [],
  enterpriseValues = [],
  incomeStatement = [],
} = {}) {
  const byYear = new Map();

  for (const km of keyMetrics) {
    const year = fiscalYearFromRow(km);
    if (year == null) continue;
    upsertYear(byYear, year, {
      date: km.date ?? null,
      enterpriseValue: num(km.enterpriseValue),
    });
  }

  for (const bs of balanceSheet) {
    const year = fiscalYearFromRow(bs);
    if (year == null) continue;
    upsertYear(byYear, year, {
      date: bs.date ?? null,
      cash: num(bs.cashAndCashEquivalents),
      debt: num(bs.totalDebt),
      commonStock: num(bs.commonStock),
      balanceRow: bs,
    });
  }

  for (const ev of enterpriseValues) {
    const year = fiscalYearFromRow(ev);
    if (year == null) continue;
    upsertYear(byYear, year, {
      date: ev.date ?? null,
      numberOfShares: num(ev.numberOfShares),
      enterpriseValue: num(ev.enterpriseValue) ?? byYear.get(year)?.enterpriseValue ?? null,
      evRow: ev,
    });
  }

  for (const isRow of incomeStatement) {
    const year = fiscalYearFromRow(isRow);
    if (year == null) continue;
    upsertYear(byYear, year, {
      incomeRow: isRow,
    });
  }

  return [...byYear.values()]
    .sort((a, b) => a.year - b.year)
    .map((row) => {
      const shares = sharesDenominator(row.balanceRow, row.evRow, row.incomeRow);
      const fairValue = computeEvFairValuePerShare({
        enterpriseValue: row.enterpriseValue,
        cash: row.cash,
        debt: row.debt,
        shares,
      });
      return {
        year: row.year,
        date: row.date ?? `${row.year}-12-31`,
        fairValue,
      };
    })
    .filter((r) => r.fairValue != null);
}

/** Collapse daily/light EOD rows to one point per calendar month (last close in month). */
export function aggregateMonthlyPrices(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const byMonth = new Map();
  for (const row of rows) {
    const date = String(row?.date || "").slice(0, 10);
    const price = num(row?.price ?? row?.close ?? row?.adjClose);
    if (!date || price == null || price <= 0) continue;
    const monthKey = date.slice(0, 7);
    const prev = byMonth.get(monthKey);
    if (!prev || date >= prev.date) byMonth.set(monthKey, { date, price });
  }
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}
