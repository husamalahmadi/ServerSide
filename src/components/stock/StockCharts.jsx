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
        <div style={{ height: "100%", width: `${curPct}%`, background: "#2563eb" }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 3,
            left: `${fairPct}%`,
            background: "#10b981",
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

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: "100%", display: "block", maxWidth: "100%" }}
      direction={dir}
    >
      <text x={w / 2} y={16} textAnchor="middle" style={{ fontSize: 14, fontWeight: 900 }}>
        {title}
      </text>
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#e5e7eb" />
      <path d={dAttr} fill="none" stroke="#0f4a5a" strokeWidth="2" />
      {data.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <circle cx={xs(i)} cy={ys(p.value)} r="3.5" fill="#0f4a5a" />
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
