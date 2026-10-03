import React, { useEffect, useId, useMemo, useState } from "react";
import { fmtBill } from "../../domain/formatting.js";
import {
  buildEarningsView,
  displayScale,
  formatEps,
  formatSurprise,
  surprisePct,
  surpriseTone,
} from "../../domain/earningsSeries.js";
import { RetryButton } from "../RetryButton.jsx";

function formatLong(date, lang) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(lang === "ar" ? "ar" : "en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function axisParts(date, lang) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { month: date, year: "" };
  if (lang === "ar") {
    return {
      month: d.toLocaleDateString("ar", { month: "numeric" }),
      year: d.toLocaleDateString("ar", { year: "2-digit" }),
    };
  }
  return {
    month: d.toLocaleDateString("en", { month: "short" }),
    year: d.toLocaleDateString("en", { year: "2-digit" }),
  };
}

function toneLabel(tone, t) {
  if (tone === "beat") return t("EARNINGS_BEAT");
  if (tone === "miss") return t("EARNINGS_MISS");
  if (tone === "inline") return t("EARNINGS_INLINE");
  return "";
}

function BeatRing({ beat, total }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = total ? beat / total : 0;
  const shown = total ? Math.round(pct * 100) : null;
  const stroke = !total ? "#d5deea" : pct >= 0.5 ? "#00d27a" : "#e63757";
  return (
    <svg className="tp-earn-ring" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e8eef6" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="23.5" textAnchor="middle" className="tp-earn-ring-text">
        {shown == null ? "—" : shown}
      </text>
    </svg>
  );
}

function DualBarChart({
  title,
  points,
  actualKey,
  estimateKey,
  formatValue,
  activeIndex,
  onSelect,
  lang,
  t,
  badge,
}) {
  const uid = useId().replace(/:/g, "");
  const w = 560;
  const h = 236;
  const pad = { t: 16, r: 8, b: 36, l: 52 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  const model = useMemo(() => {
    const values = points.flatMap((p) => [p[actualKey], p[estimateKey]]).filter((v) => Number.isFinite(v));
    const scale = displayScale(values);
    if (!scale || !points.length) return null;
    const span = scale.max - scale.min || 1;
    const yOf = (v) => pad.t + (1 - (v - scale.min) / span) * ih;
    const y0 = yOf(0);
    const slot = iw / points.length;
    const barW = Math.min(14, Math.max(5, slot * 0.26));
    const ticks = [0, 1, 2, 3].map((i) => {
      const value = scale.max - ((scale.max - scale.min) * i) / 3;
      return { value, y: pad.t + (ih * i) / 3 };
    });
    const groups = points.map((point, i) => {
      const cx = pad.l + slot * i + slot / 2;
      const hasAct = Number.isFinite(point[actualKey]);
      const hasEst = Number.isFinite(point[estimateKey]);
      let estX = cx - barW - 1.25;
      let actX = cx + 1.25;
      if (hasEst && !hasAct) estX = cx - barW / 2;
      if (hasAct && !hasEst) actX = cx - barW / 2;
      const geom = (value) => {
        if (value == null || !Number.isFinite(value)) return null;
        const shown = Math.min(scale.max, Math.max(scale.min, value));
        const clipped = Math.abs(shown - value) > Math.max(Math.abs(value) * 0.001, 1e-6);
        const yv = yOf(shown);
        const top = Math.min(yv, y0);
        const height = Math.max(Math.abs(yv - y0), Math.abs(value) > 0 ? 1.5 : 0);
        return { top, height, clipped };
      };
      return {
        point,
        i,
        slotX: pad.l + slot * i,
        slotW: slot,
        est: geom(point[estimateKey]),
        act: geom(point[actualKey]),
        estX,
        actX,
        label: axisParts(point.date, lang),
        cx,
      };
    });
    return { scale, y0, barW, ticks, groups };
  }, [points, actualKey, estimateKey, lang, pad.t, pad.l, iw, ih]);

  if (!model) {
    return (
      <section className="tp-earn-chart">
        <header className="tp-earn-chart-head">
          <h3>{title}</h3>
        </header>
        <p className="tp-earn-chart-empty">{t("EARNINGS_METRIC_EMPTY")}</p>
      </section>
    );
  }

  const fillFor = (point, kind) => {
    if (kind === "estimate") return point.upcoming ? `url(#${uid}-soon)` : `url(#${uid}-est)`;
    const tone = surpriseTone(surprisePct(point[actualKey], point[estimateKey]));
    if (tone === "miss") return `url(#${uid}-miss)`;
    if (tone === "inline") return `url(#${uid}-inline)`;
    if (tone === "beat") return `url(#${uid}-beat)`;
    return `url(#${uid}-inline)`;
  };

  return (
    <section className="tp-earn-chart">
      <header className="tp-earn-chart-head">
        <h3>{title}</h3>
        {badge ? <span className={`tp-earn-pill is-${badge.tone}`}>{badge.text}</span> : null}
      </header>
      <svg
        className="tp-earn-svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={title}
        dir="ltr"
      >
        <defs>
          <linearGradient id={`${uid}-beat`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3ee6a0" />
            <stop offset="100%" stopColor="#00b368" />
          </linearGradient>
          <linearGradient id={`${uid}-miss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7b93" />
            <stop offset="100%" stopColor="#e63757" />
          </linearGradient>
          <linearGradient id={`${uid}-inline`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7eb6f5" />
            <stop offset="100%" stopColor="#2c7be5" />
          </linearGradient>
          <linearGradient id={`${uid}-est`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eef2f7" />
            <stop offset="100%" stopColor="#d5deea" />
          </linearGradient>
          <linearGradient id={`${uid}-soon`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff8f1" />
            <stop offset="100%" stopColor="#ffe8d4" />
          </linearGradient>
        </defs>
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="#fbfcfe" rx="6" />
        {model.groups.map((group) => (
          <rect
            key={`col-${group.point.date}`}
            x={group.slotX + 2}
            y={pad.t}
            width={Math.max(0, group.slotW - 4)}
            height={ih}
            rx="6"
            className={group.i === activeIndex ? "tp-earn-col is-active" : "tp-earn-col"}
          />
        ))}
        {model.ticks.map((tick) => (
          <g key={tick.y}>
            <line x1={pad.l} y1={tick.y} x2={w - pad.r} y2={tick.y} className="tp-earn-gridline" />
            <text x={pad.l - 8} y={tick.y + 3} textAnchor="end" className="tp-earn-axis">
              {formatValue(tick.value)}
            </text>
          </g>
        ))}
        <line x1={pad.l} y1={model.y0} x2={w - pad.r} y2={model.y0} className="tp-earn-zero" />
        {model.groups.map((group) => {
          const drawBar = (geom, x, kind) => {
            if (!geom || geom.height <= 0) return null;
            const upcomingEst = kind === "estimate" && group.point.upcoming;
            return (
              <g key={kind}>
                <rect
                  x={x}
                  y={geom.top}
                  width={model.barW}
                  height={geom.height}
                  rx="3"
                  fill={fillFor(group.point, kind)}
                  stroke={upcomingEst ? "#f5803e" : "none"}
                  strokeWidth={upcomingEst ? 1.25 : 0}
                  strokeDasharray={upcomingEst ? "3 2" : undefined}
                />
              </g>
            );
          };
          const clipValue = group.act?.clipped
            ? group.point[actualKey]
            : group.est?.clipped
              ? group.point[estimateKey]
              : null;
          return (
            <g
              key={group.point.date}
              className="tp-earn-group"
              onMouseEnter={() => onSelect(group.i)}
              onClick={() => onSelect(group.i)}
            >
              <rect
                x={group.slotX}
                y={pad.t}
                width={group.slotW}
                height={ih + 28}
                fill="transparent"
              />
              {drawBar(group.est, group.estX, "estimate")}
              {drawBar(group.act, group.actX, "actual")}
              {clipValue != null ? (
                <text x={group.cx} y={pad.t + 12} textAnchor="middle" className="tp-earn-clip">
                  {formatValue(clipValue)}
                </text>
              ) : null}
              <text x={group.cx} y={h - 16} textAnchor="middle" className="tp-earn-xlabel">
                {group.label.month}
              </text>
              <text x={group.cx} y={h - 5} textAnchor="middle" className="tp-earn-xyear">
                {group.label.year}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function MetricReadout({ label, actual, estimate, format, currency, t }) {
  const surprise = surprisePct(actual, estimate);
  const tone = surpriseTone(surprise);
  const withUnit = (value) => (value == null ? "—" : `${format(value)} ${currency}`.trim());
  return (
    <div className="tp-earn-read">
      <div className="tp-earn-read-head">
        <span>{label}</span>
        {tone !== "none" ? <span className={`tp-earn-pill is-${tone}`}>{toneLabel(tone, t)}</span> : null}
      </div>
      <div className="tp-earn-read-row">
        <span>{t("EARNINGS_REPORTED")}</span>
        <b>{withUnit(actual)}</b>
      </div>
      <div className="tp-earn-read-row">
        <span>{t("EARNINGS_EXPECTED")}</span>
        <b>{withUnit(estimate)}</b>
      </div>
      <div className="tp-earn-read-row">
        <span>{t("EARNINGS_SURPRISE")}</span>
        <b className={`tp-earn-surprise is-${tone}`}>{formatSurprise(surprise)}</b>
      </div>
    </div>
  );
}

export function EarningsPanel({ rows, loading, error, onRetry, currency, lang, dir, t }) {
  const view = useMemo(() => buildEarningsView(rows), [rows]);
  const [active, setActive] = useState(view.defaultIndex);

  useEffect(() => {
    setActive(view.defaultIndex);
  }, [view]);

  if (loading) {
    return (
      <div className="tp-earn-skel" aria-busy="true" aria-label={t("EARNINGS_LOADING")}>
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (error) {
    return (
      <div className="tp-earn-error">
        <p>{error}</p>
        <RetryButton onRetry={onRetry} t={t} />
      </div>
    );
  }

  if (!view.series.length) {
    return <p className="tp-earn-empty">{t("EARNINGS_NO_DATA")}</p>;
  }

  const point = view.series[active] || view.series[view.defaultIndex];
  const latest = [...view.series].reverse().find((row) => !row.upcoming) || null;
  const epsBadge = latest
    ? {
        tone: surpriseTone(surprisePct(latest.epsActual, latest.epsEstimated)),
        text: formatSurprise(surprisePct(latest.epsActual, latest.epsEstimated)),
      }
    : null;
  const revBadge = latest
    ? {
        tone: surpriseTone(surprisePct(latest.revenueActual, latest.revenueEstimated)),
        text: formatSurprise(surprisePct(latest.revenueActual, latest.revenueEstimated)),
      }
    : null;
  const epsValues = view.series.flatMap((row) => [row.epsActual, row.epsEstimated]);
  const revValues = view.series.flatMap((row) => [row.revenueActual, row.revenueEstimated]);
  const clipped = Boolean(displayScale(epsValues)?.clipped || displayScale(revValues)?.clipped);
  const beatPct = view.reportedCount ? Math.round((view.beatCount / view.reportedCount) * 100) : null;

  return (
    <div className="tp-earn" dir={dir}>
      <p className="tp-earn-lead">{t("EARNINGS_SUB")}</p>

      <div className="tp-earn-stats">
        <div className="tp-earn-stat">
          <BeatRing beat={view.beatCount} total={view.reportedCount} />
          <div>
            <div className="tp-earn-stat-label">{t("EARNINGS_BEAT_RATE")}</div>
            <div className="tp-earn-stat-value">
              {view.reportedCount
                ? `${view.beatCount} ${t("EARNINGS_OF")} ${view.reportedCount}`
                : "—"}
            </div>
            <div className="tp-earn-stat-hint">
              {beatPct == null ? t("EARNINGS_BEAT_HINT") : `${beatPct}% · ${t("EARNINGS_BEAT_HINT")}`}
            </div>
            {view.revReportedCount ? (
              <div className="tp-earn-stat-hint">
                {t("EARNINGS_REVENUE")}: {view.revBeatCount} {t("EARNINGS_OF")} {view.revReportedCount}
              </div>
            ) : null}
          </div>
        </div>

        <div className="tp-earn-stat">
          <div
            className={`tp-earn-stat-mark is-${surpriseTone(view.avgSurprise)}`}
            aria-hidden="true"
          >
            {view.avgSurprise == null ? "—" : view.avgSurprise > 0 ? "↑" : view.avgSurprise < 0 ? "↓" : "–"}
          </div>
          <div>
            <div className="tp-earn-stat-label">{t("EARNINGS_AVG_SURPRISE")}</div>
            <div className={`tp-earn-stat-value is-${surpriseTone(view.avgSurprise)}`}>
              {formatSurprise(view.avgSurprise)}
            </div>
            <div className="tp-earn-stat-hint">{t("EARNINGS_AVG_HINT")}</div>
          </div>
        </div>

        <div className="tp-earn-stat">
          <div className="tp-earn-stat-mark is-upcoming" aria-hidden="true">
            {view.next?.future === false ? "…" : "◷"}
          </div>
          <div>
            <div className="tp-earn-stat-label">{t("EARNINGS_NEXT")}</div>
            <div className="tp-earn-stat-value">
              {view.next ? formatLong(view.next.date, lang) : "—"}
            </div>
            <div className="tp-earn-stat-hint">
              {view.next
                ? `${t("EARNINGS_EPS")} ${formatEps(view.next.epsEstimated)} · ${fmtBill(view.next.revenueEstimated)}`
                : t("EARNINGS_NO_UPCOMING")}
            </div>
          </div>
        </div>
      </div>

      <div className="tp-earn-legend">
        <span><i className="tp-earn-swatch is-expected" />{t("EARNINGS_EXPECTED")}</span>
        <span><i className="tp-earn-swatch is-beat" />{t("EARNINGS_BEAT")}</span>
        <span><i className="tp-earn-swatch is-miss" />{t("EARNINGS_MISS")}</span>
        <span><i className="tp-earn-swatch is-inline" />{t("EARNINGS_INLINE")}</span>
        <span><i className="tp-earn-swatch is-upcoming" />{t("EARNINGS_UPCOMING")}</span>
      </div>

      <div className="tp-earn-charts" dir="ltr">
        <DualBarChart
          title={`${t("EARNINGS_REVENUE")}${currency ? ` (${currency})` : ""}`}
          points={view.series}
          actualKey="revenueActual"
          estimateKey="revenueEstimated"
          formatValue={fmtBill}
          activeIndex={active}
          onSelect={setActive}
          lang={lang}
          t={t}
          badge={revBadge && revBadge.tone !== "none" ? revBadge : null}
        />
        <DualBarChart
          title={t("EARNINGS_EPS")}
          points={view.series}
          actualKey="epsActual"
          estimateKey="epsEstimated"
          formatValue={formatEps}
          activeIndex={active}
          onSelect={setActive}
          lang={lang}
          t={t}
          badge={epsBadge && epsBadge.tone !== "none" ? epsBadge : null}
        />
      </div>

      {clipped ? <p className="tp-earn-note">{t("EARNINGS_CLIPPED")}</p> : null}

      <div className="tp-earn-rail" dir="ltr" role="tablist" aria-label={t("EARNINGS_SELECT")}>
        {view.series.map((row, i) => {
          const tone = row.upcoming
            ? "upcoming"
            : surpriseTone(surprisePct(row.epsActual, row.epsEstimated));
          const parts = axisParts(row.date, lang);
          return (
            <button
              key={row.date}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`tp-earn-q${i === active ? " is-active" : ""}`}
              onClick={() => setActive(i)}
            >
              <i className={`tp-earn-dot is-${tone === "none" ? "inline" : tone}`} />
              {parts.month} {parts.year}
            </button>
          );
        })}
      </div>

      {point ? (
        <div className="tp-earn-detail">
          <div className="tp-earn-detail-date">
            <strong>{formatLong(point.date, lang)}</strong>
            {point.upcoming ? (
              <span className="tp-earn-pill is-upcoming">
                {point.future ? t("EARNINGS_UPCOMING") : t("EARNINGS_PENDING")}
              </span>
            ) : null}
          </div>
          <div className="tp-earn-detail-grid" dir="ltr">
            <MetricReadout
              label={t("EARNINGS_REVENUE")}
              actual={point.revenueActual}
              estimate={point.revenueEstimated}
              format={fmtBill}
              currency={currency}
              t={t}
            />
            <MetricReadout
              label={t("EARNINGS_EPS")}
              actual={point.epsActual}
              estimate={point.epsEstimated}
              format={formatEps}
              currency={currency}
              t={t}
            />
          </div>
        </div>
      ) : null}

      <p className="tp-earn-source">{t("EARNINGS_SOURCE")}</p>
    </div>
  );
}
