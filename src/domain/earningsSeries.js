/**
 * Quarterly earnings vs consensus, shaped for the stock-page charts.
 * Reported (actual) and expected (estimate) stay paired on each period.
 */

const MAX_REPORTED = 8;

function num(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function surprisePct(actual, estimate) {
  if (actual == null || estimate == null) return null;
  const denom = Math.abs(estimate);
  if (denom < 1e-9) return Math.abs(actual) < 1e-9 ? 0 : null;
  return ((actual - estimate) / denom) * 100;
}

export function surpriseTone(pct) {
  if (pct == null || !Number.isFinite(pct)) return "none";
  if (Math.abs(pct) < 1) return "inline";
  return pct > 0 ? "beat" : "miss";
}

export function formatSurprise(pct) {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  const digits = Math.abs(pct) >= 100 ? 0 : 1;
  return `${sign}${pct.toFixed(digits)}%`;
}

export function formatEps(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 1 : abs >= 1 ? 2 : 3;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  });
}

/**
 * Axis range for grouped bars. A single extreme print is capped so the
 * rest of the quarters stay readable; callers label the real value.
 */
export function displayScale(values) {
  const finite = (values || []).filter((v) => Number.isFinite(v));
  if (!finite.length) return null;

  const capAbs = (absValues) => {
    if (!absValues.length) return 0;
    const sorted = [...absValues].sort((a, b) => a - b);
    const top = sorted[sorted.length - 1];
    if (sorted.length < 3) return top;
    const second = sorted[sorted.length - 2];
    if (second > 0 && top > second * 3.5) {
      const p75 = sorted[Math.floor((sorted.length - 1) * 0.75)];
      return Math.max(second * 1.45, p75 * 2);
    }
    return top;
  };

  const pos = finite.filter((v) => v > 0);
  const negAbs = finite.filter((v) => v < 0).map((v) => Math.abs(v));
  const hi = capAbs(pos);
  const loMag = capAbs(negAbs);
  const lo = loMag ? -loMag : 0;
  const clipped =
    pos.some((v) => v > hi + 1e-8) || finite.some((v) => v < 0 && -v > loMag + 1e-8);
  const span = Math.max(hi - lo, 1e-9);
  const pad = span * 0.18;
  let min = lo < 0 ? lo - pad : 0;
  let max = hi > 0 ? hi + pad : 0;
  if (max === min) {
    max += 1;
    min -= 1;
  }
  return { min, max, clipped };
}

function isReported(row) {
  return row.epsActual != null || row.revenueActual != null;
}

export function buildEarningsView(rows) {
  const parsed = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const date = String(row?.date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return {
        date,
        epsActual: num(row.epsActual),
        epsEstimated: num(row.epsEstimated),
        revenueActual: num(row.revenueActual),
        revenueEstimated: num(row.revenueEstimated),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  const reported = parsed.filter(isReported);
  const lastReportedDate = reported.length ? reported[reported.length - 1].date : "";
  const today = todayIso();
  const pending = parsed.filter(
    (row) =>
      !isReported(row) &&
      row.date >= lastReportedDate &&
      (row.epsEstimated != null || row.revenueEstimated != null)
  );
  const next = pending.find((row) => row.date >= today) || pending[0] || null;
  const history = reported.slice(-MAX_REPORTED).map((row) => ({ ...row, upcoming: false, future: false }));
  const series = next
    ? [...history, { ...next, upcoming: true, future: next.date >= today }]
    : history;

  const epsPairs = history.filter((row) => row.epsActual != null && row.epsEstimated != null);
  const revPairs = history.filter((row) => row.revenueActual != null && row.revenueEstimated != null);
  const epsBeats = epsPairs.filter((row) => surpriseTone(surprisePct(row.epsActual, row.epsEstimated)) === "beat");
  const revBeats = revPairs.filter(
    (row) => surpriseTone(surprisePct(row.revenueActual, row.revenueEstimated)) === "beat"
  );
  const surprises = epsPairs
    .map((row) => surprisePct(row.epsActual, row.epsEstimated))
    .filter((n) => n != null);
  const avgSurprise = surprises.length
    ? surprises.reduce((sum, n) => sum + n, 0) / surprises.length
    : null;

  let defaultIndex = 0;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (!series[i].upcoming) {
      defaultIndex = i;
      break;
    }
  }

  return {
    series,
    next,
    beatCount: epsBeats.length,
    reportedCount: epsPairs.length,
    revBeatCount: revBeats.length,
    revReportedCount: revPairs.length,
    avgSurprise,
    defaultIndex,
  };
}
