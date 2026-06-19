import React, { useId, useMemo } from "react";
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

function labelWidth(text) {
  return Math.max(22, String(text || "").length * 5.2 + 8);
}

/**
 * Light dual-series chart: monthly stock price + yearly EV-based fair value.
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
  const fillId = useId().replace(/:/g, "");
  const h = 220;
  const pad = { t: 12, r: 14, b: 28, l: 44 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const rtl = dir === "rtl";

  const { pricePath, fairPath, fairDots, fairCallout, xTicks, priceTicks, hasFair } = useMemo(() => {
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
        fairCallout: null,
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
    let fairCallout = null;
    if (fairs.length) {
      fairPath = fairs.map((f, i) => `${i ? "L" : "M"} ${xs(f.ts)} ${ys(f.value)}`).join(" ");
      fairDots = fairs.map((f) => ({
        cx: xs(f.ts),
        cy: ys(f.value),
        year: f.year,
        valueLabel: formatPrice(f.value),
        labelW: labelWidth(formatPrice(f.value)),
      }));
      const last = fairs[fairs.length - 1];
      const tag = t("FV_CHART_FAIR_LINE");
      fairCallout = {
        x: xs(last.ts),
        y: ys(last.value),
        text: tag,
        tagW: labelWidth(tag) + 6,
      };
    }

    const xTickCount = Math.min(5, prices.length);
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
      fairCallout,
      xTicks,
      priceTicks,
      hasFair: fairs.length > 0,
    };
  }, [monthlyPrices, yearlyFairValue, iw, ih, lang, t]);

  if (!monthlyPrices?.length) {
    return (
      <div className="tp-fv-chart-empty">
        <p>{t("FV_CHART_NO_DATA")}</p>
      </div>
    );
  }

  const ariaLabel = hasFair
    ? `${t("FV_CHART_PRICE")} ${t("FV_CHART_VS")} ${t("FV_CHART_FAIR_VALUE")}`
    : t("FV_CHART_PRICE");

  return (
    <div className="tp-fv-chart" dir={dir} role="img" aria-label={ariaLabel}>
      <div className="tp-fv-chart-key">
        <span className="tp-fv-chart-key-item tp-fv-chart-key-price">
          <span className="tp-fv-chart-key-line" aria-hidden />
          <span className="tp-fv-chart-key-text">
            {t("FV_CHART_PRICE")} <span className="tp-fv-chart-key-meta">({currency})</span>
          </span>
        </span>
        {hasFair ? (
          <span className="tp-fv-chart-key-item tp-fv-chart-key-fair">
            <span className="tp-fv-chart-key-line tp-fv-chart-key-line-fair" aria-hidden />
            <span className="tp-fv-chart-key-text">{t("FV_CHART_FAIR_VALUE")}</span>
          </span>
        ) : null}
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="tp-fv-chart-svg" aria-hidden>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7eb6ef" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#7eb6ef" stopOpacity="0" />
          </linearGradient>
        </defs>

        {priceTicks.map((tick, i) => (
          <g key={`pg-${i}`}>
            <line x1={pad.l} y1={tick.y} x2={w - pad.r} y2={tick.y} stroke="#eef2f7" strokeWidth="1" />
            <text x={pad.l - 6} y={tick.y + 3} textAnchor="end" className="tp-fv-chart-axis">
              {formatPrice(tick.value)}
            </text>
          </g>
        ))}

        <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#e5eaf0" strokeWidth="1" />

        {pricePath ? (
          <>
            <path
              d={`${pricePath} L ${w - pad.r} ${h - pad.b} L ${pad.l} ${h - pad.b} Z`}
              fill={`url(#${fillId})`}
            />
            <path
              d={pricePath}
              fill="none"
              stroke="#7eb6ef"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {hasFair && fairPath ? (
          <>
            <path
              d={fairPath}
              fill="none"
              stroke="#2ecc87"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 3"
              opacity="0.95"
            />
            {fairCallout ? (
              <g
                transform={`translate(${rtl ? fairCallout.x - fairCallout.tagW - 6 : fairCallout.x + 8}, ${fairCallout.y - 6})`}
              >
                <rect
                  x="0"
                  y="0"
                  width={fairCallout.tagW}
                  height="14"
                  rx="4"
                  fill="#ecfdf5"
                  stroke="#a7f3d0"
                  strokeWidth="0.75"
                />
                <text
                  x={fairCallout.tagW / 2}
                  y="10"
                  textAnchor="middle"
                  className="tp-fv-chart-fv-callout"
                >
                  {fairCallout.text}
                </text>
              </g>
            ) : null}
          </>
        ) : null}

        {fairDots.map((d) => (
          <g key={d.year}>
            <circle cx={d.cx} cy={d.cy} r="3.5" fill="#fff" stroke="#2ecc87" strokeWidth="1.5" />
            <rect
              x={d.cx - d.labelW / 2}
              y={d.cy - 19}
              width={d.labelW}
              height="11"
              rx="3"
              fill="#f0fdf7"
              stroke="#bbf7d0"
              strokeWidth="0.6"
            />
            <text x={d.cx} y={d.cy - 11} textAnchor="middle" className="tp-fv-chart-fv-value">
              {d.valueLabel}
            </text>
            <text x={d.cx} y={d.cy + 13} textAnchor="middle" className="tp-fv-chart-year">
              {d.year}
            </text>
          </g>
        ))}

        {xTicks.map((tick, i) => (
          <text key={`x-${i}`} x={tick.x} y={h - pad.b + 14} textAnchor="middle" className="tp-fv-chart-axis">
            {tick.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
