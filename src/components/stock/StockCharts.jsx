import React from "react";
import { fmt2, sortSeries, trendText } from "../../domain/formatting.js";

export function CompareBar({ current, fair, currency, dir = "ltr", t }) {
  const cur = Number(current);
  const fv = Number(fair);
  const max = Math.max(cur, fv, 1);
  const curPct = (cur / max) * 100;
  const fairPct = (fv / max) * 100;

  return (
    <div style={{ width: "100%", maxWidth: 360, minWidth: 0, display: "grid", gap: 6 }}>
      <div
        style={{
          height: 10,
          background: "#e5e7eb",
          borderRadius: 999,
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
        dir={dir}
      >
        <div style={{ height: "100%", width: `${curPct}%`, background: "#2c7be5", borderRadius: 999 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 3,
            left: `${fairPct}%`,
            background: "#00d27a",
          }}
        />
      </div>
      <div style={{ display: "grid", gap: 2, fontSize: 12, color: "#374151" }}>
        <span style={{ overflowWrap: "anywhere" }}>
          {t("CUR_PRICE")}: <b>{fmt2(cur)} {currency}</b>
        </span>
        <span style={{ overflowWrap: "anywhere" }}>
          {t("FAIR_AVG")}: <b>{fmt2(fv)} {currency}</b>
        </span>
      </div>
    </div>
  );
}

export function LineChart({ title, series, w = 380, dir = "ltr" }) {
  const data = sortSeries(series);
  const h = 220;
  const pad = { t: 22, r: 18, b: 28, l: 56 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  if (!data.length) return <div style={{ fontSize: 12, color: "#6b7280" }}>{title}: —</div>;

  const xs = (i) => pad.l + (i * iw) / Math.max(1, data.length - 1);
  const vals = data.map((d) => d.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    const d = Math.abs(min || 1) * 0.1;
    min -= d;
    max += d;
  }
  const ys = (v) => pad.t + (1 - (v - min) / (max - min)) * ih;
  const dAttr = data.map((p, i) => `${i ? "L" : "M"} ${xs(i)} ${ys(p.value)}`).join(" ");
  const areaAttr = `${dAttr} L ${pad.l + iw} ${pad.t + ih} L ${pad.l} ${pad.t + ih} Z`;
  const yTicks = [0, 1, 2, 3, 4].map((i) => {
    const ratio = i / 4;
    const value = max - (max - min) * ratio;
    return { value, y: pad.t + ih * ratio };
  });

  const formatCompact = (n) => {
    const abs = Math.abs(Number(n) || 0);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${Math.round(n)}`;
  };

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: "100%", display: "block", maxWidth: "100%" }}
      direction={dir}
    >
      <text x={pad.l} y={16} textAnchor="start" style={{ fontSize: 13, fontWeight: 700, fill: "#344050" }}>
        {title}
      </text>
      {yTicks.map((tick, i) => (
        <g key={`y-${i}`}>
          <line x1={pad.l} y1={tick.y} x2={w - pad.r} y2={tick.y} stroke="#edf2f9" />
          <text
            x={pad.l - 8}
            y={tick.y + 3}
            textAnchor="end"
            style={{ fontSize: 10, fill: "#748194" }}
          >
            {formatCompact(tick.value)}
          </text>
        </g>
      ))}
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#e3e8ef" />
      <path d={areaAttr} fill="#2c7be5" opacity="0.12" />
      <path d={dAttr} fill="none" stroke="#2c7be5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <circle cx={xs(i)} cy={ys(p.value)} r="4" fill="#fff" stroke="#2c7be5" strokeWidth="2" />
          <text
            x={xs(i)}
            y={h - pad.b + 16}
            textAnchor="middle"
            style={{ fontSize: 10, fill: "#6b7280" }}
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ChartBlock({ title, series, w, dir, t }) {
  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
      <LineChart title={title} series={series} w={w} dir={dir} />
      <div style={{ fontSize: 12, color: "#374151", overflowWrap: "anywhere" }}>
        <span style={{ fontWeight: 900 }}>{t("TREND")}:</span>{" "}
        <span style={{ fontWeight: 800 }}>{trendText(series, t)}</span>
      </div>
    </div>
  );
}
