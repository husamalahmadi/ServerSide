import React, { useMemo } from "react";
import { fmt2 } from "../../domain/formatting.js";

function parseTs(dateStr) {
  const t = Date.parse(String(dateStr || "").slice(0, 10));
  return Number.isFinite(t) ? t : null;
}

function formatMonth(dateStr, lang) {
  const d = new Date(String(dateStr).slice(0, 10));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "ar" ? "ar" : "en", { month: "short", year: "2-digit" });
}

function formatPrice(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1000) return fmt2(x);
  if (Math.abs(x) >= 100) return x.toFixed(1);
  return x.toFixed(2);
}

/**
 * Dual-axis chart: monthly stock price + yearly EV-based fair value on one timeline.
 */
export function FairValueChart({
  monthlyPrices = [],
  yearlyFairValue = [],
  currency = "USD",
  dir = "ltr",
  lang = "en",
  t,
  w = 640,
}) {
  const h = 280;
  const pad = { t: 22, r: 18, b: 36, l: 52 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  const { pricePath, fairPath, fairDots, xTicks, priceTicks, hasFair } = useMemo(() => {
    const prices = (monthlyPrices || [])
      .map((p) => ({ ts: parseTs(p.date), price: Number(p.price), date: p.date }))
      .filter((p) => p.ts != null && Number.isFinite(p.price) && p.price > 0)
      .sort((a, b) => a.ts - b.ts);

    const fairs = (yearlyFairValue || [])
      .map((f) => ({
        ts: parseTs(f.date || `${f.year}-12-31`),
        value: Number(f.fairValue),
        year: f.year,
        date: f.date || `${f.year}-12-31`,
      }))
      .filter((f) => f.ts != null && Number.isFinite(f.value) && f.value > 0)
      .sort((a, b) => a.ts - b.ts);

    if (!prices.length) {
      return {
        pricePath: "",
        fairPath: "",
        fairDots: [],
        xTicks: [],
        priceTicks: [],
        hasFair: false,
      };
    }

    const minTs = prices[0].ts;
    const maxTs = prices[prices.length - 1].ts;
    const span = Math.max(maxTs - minTs, 1);
    const xs = (ts) => pad.l + ((ts - minTs) / span) * iw;

    const priceVals = prices.map((p) => p.price);
    const fairVals = fairs.map((f) => f.value);
    const allVals = fairs.length ? [...priceVals, ...fairVals] : priceVals;
    let yMin = Math.min(...allVals);
    let yMax = Math.max(...allVals);
    if (yMin === yMax) {
      const d = Math.abs(yMin || 1) * 0.08;
      yMin -= d;
      yMax += d;
    }
    const ys = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * ih;

    const pricePath = prices
      .map((p, i) => `${i ? "L" : "M"} ${xs(p.ts)} ${ys(p.price)}`)
      .join(" ");

    let fairPath = "";
    let fairDots = [];
    if (fairs.length) {
      fairPath = fairs.map((f, i) => `${i ? "L" : "M"} ${xs(f.ts)} ${ys(f.value)}`).join(" ");
      fairDots = fairs.map((f) => ({
        cx: xs(f.ts),
        cy: ys(f.value),
        year: f.year,
        valueLabel: formatPrice(f.value),
      }));
    }

    const xTickCount = Math.min(6, prices.length);
    const xTicks = Array.from({ length: xTickCount }, (_, i) => {
      const idx = Math.round((i * (prices.length - 1)) / Math.max(1, xTickCount - 1));
      const p = prices[idx];
      return { x: xs(p.ts), label: formatMonth(p.date, lang) };
    });

    const priceTicks = [0, 1, 2, 3].map((i) => {
      const ratio = i / 3;
      const value = yMax - (yMax - yMin) * ratio;
      return { y: pad.t + ih * ratio, value };
    });

    return {
      pricePath,
      fairPath,
      fairDots,
      xTicks,
      priceTicks,
      hasFair: fairs.length > 0,
    };
  }, [monthlyPrices, yearlyFairValue, iw, ih, lang]);

  if (!monthlyPrices?.length) {
    return (
      <div className="tp-fv-chart-empty">
        <p>{t("FV_CHART_NO_DATA")}</p>
      </div>
    );
  }

  return (
    <div className="tp-fv-chart" dir={dir}>
      <svg viewBox={`0 0 ${w} ${h}`} className="tp-fv-chart-svg" aria-hidden>
        <defs>
          <linearGradient id="tpFvPriceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2c7be5" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2c7be5" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {priceTicks.map((tick, i) => (
          <g key={`pg-${i}`}>
            <line x1={pad.l} y1={tick.y} x2={w - pad.r} y2={tick.y} stroke="#e8eef6" strokeWidth="1" />
            <text x={pad.l - 8} y={tick.y + 4} textAnchor="end" className="tp-fv-chart-axis">
              {formatPrice(tick.value)}
            </text>
          </g>
        ))}

        <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#d8e2ef" />

        {pricePath ? (
          <>
            <path
              d={`${pricePath} L ${w - pad.r} ${h - pad.b} L ${pad.l} ${h - pad.b} Z`}
              fill="url(#tpFvPriceFill)"
            />
            <path d={pricePath} fill="none" stroke="#2c7be5" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : null}

        {hasFair && fairPath ? (
          <path
            d={fairPath}
            fill="none"
            stroke="#00b368"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
        ) : null}

        {fairDots.map((d) => (
          <g key={d.year}>
            <circle cx={d.cx} cy={d.cy} r="5" fill="#fff" stroke="#00b368" strokeWidth="2.5" />
            <text x={d.cx} y={d.cy - 11} textAnchor="middle" className="tp-fv-chart-fv-value">
              {d.valueLabel}
            </text>
            <text x={d.cx} y={d.cy + 17} textAnchor="middle" className="tp-fv-chart-year">
              {d.year}
            </text>
          </g>
        ))}

        {xTicks.map((tick, i) => (
          <text key={`x-${i}`} x={tick.x} y={h - pad.b + 18} textAnchor="middle" className="tp-fv-chart-axis">
            {tick.label}
          </text>
        ))}
      </svg>

      <div className="tp-fv-chart-legend">
        <span className="tp-fv-chart-legend-item tp-fv-chart-legend-price">
          <span className="tp-fv-chart-swatch" aria-hidden />
          {t("FV_CHART_PRICE")} ({currency})
        </span>
        {hasFair ? (
          <span className="tp-fv-chart-legend-item tp-fv-chart-legend-fair">
            <span className="tp-fv-chart-swatch tp-fv-chart-swatch-fair" aria-hidden />
            {t("FV_CHART_FAIR_VALUE")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
