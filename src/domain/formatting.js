/**
 * Shared number/trend formatting for Stock report.
 */

export function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtBill(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const abs = Math.abs(x);
  if (abs >= 1e12) return `${fmt2(x / 1e12)}T`;
  if (abs >= 1e9) return `${fmt2(x / 1e9)}B`;
  if (abs >= 1e6) return `${fmt2(x / 1e6)}M`;
  return fmt2(x);
}

export function sortSeries(series) {
  return (series || [])
    .filter((p) => Number.isFinite(Number(p?.value)))
    .map((p) => ({ label: String(p.label), value: Number(p.value) }))
    .sort((a, b) => Number(a.label) - Number(b.label));
}

export function calcTrend(series, { neutralThresholdPct = 2 } = {}) {
  const data = sortSeries(series);
  if (data.length < 2) return { kind: "no_data", pct: null };
  const first = data[0].value;
  const last = data[data.length - 1].value;
  const denom = Math.max(Math.abs(first), 1);
  const pct = ((last - first) / denom) * 100;
  if (!Number.isFinite(pct)) return { kind: "no_data", pct: null };
  if (Math.abs(pct) < neutralThresholdPct) return { kind: "neutral", pct };
  return { kind: pct > 0 ? "up" : "down", pct };
}

export function trendText(series, t) {
  const { kind, pct } = calcTrend(series);
  if (kind === "no_data") return t("NO_DATA");
  const word =
    kind === "up" ? t("UPTREND") : kind === "down" ? t("DOWNTREND") : t("NEUTRAL");
  return `${word} · ${fmt2(Math.abs(pct))}%`;
}
