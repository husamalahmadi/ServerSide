import React from "react";
import { FairValueChart } from "./FairValueChart.jsx";
import { RetryButton } from "../RetryButton.jsx";
import { fmt2 } from "../../domain/formatting.js";

function pctClass(n) {
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "tp-dcf-pos" : "tp-dcf-neg";
}

function vsPricePct(fair, price) {
  const f = Number(fair);
  const p = Number(price);
  if (!Number.isFinite(f) || !Number.isFinite(p) || p <= 0) return null;
  return ((f - p) / p) * 100;
}

function parseBeta(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

function betaBand(beta) {
  if (beta < 0) return "inverse";
  if (beta < 0.8) return "defensive";
  if (beta <= 1.2) return "market";
  return "aggressive";
}

function formatBeta(beta) {
  return beta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DcfBetaChip({ t, beta }) {
  const n = parseBeta(beta);
  if (n == null) return null;
  const band = betaBand(n);
  const hintKey = {
    inverse: "BETA_INVERSE",
    defensive: "BETA_DEFENSIVE",
    market: "BETA_MARKET",
    aggressive: "BETA_AGGRESSIVE",
  }[band];

  return (
    <aside
      className={`tp-dcf-beta tp-dcf-beta-${band}`}
      title={t("BETA_HINT")}
      aria-label={`${t("BETA")} ${formatBeta(n)}. ${t(hintKey)}`}
    >
      <span className="tp-dcf-unlocked-label">{t("BETA")}</span>
      <span className="tp-dcf-beta-value" dir="ltr">
        <span className="tp-dcf-beta-sym" aria-hidden>
          β
        </span>
        {formatBeta(n)}
      </span>
      <span className="tp-dcf-beta-hint">{t(hintKey)}</span>
    </aside>
  );
}

function parseWaccPct(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  if (pct <= 0 || pct > 80) return null;
  return pct;
}

function formatWacc(pct) {
  return `${pct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** FMP key-metrics ROIC is a ratio (0.18 = 18%). Values already in percent pass through. */
function parseRoicPct(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const pct = Math.abs(n) <= 3 ? n * 100 : n;
  if (pct <= -100 || pct > 400) return null;
  return pct;
}

function formatPts(spread, lang) {
  const locale = lang === "ar" ? "ar" : undefined;
  const body = spread.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return lang === "ar" ? `+${body} نقطة` : `+${body} pts`;
}

function DcfWaccChip({ t, lang, wacc, roic }) {
  const pct = parseWaccPct(wacc);
  if (pct == null) return null;
  const roicPct = parseRoicPct(roic);
  const recommended = roicPct != null && roicPct > pct;

  if (!recommended) {
    return (
      <aside className="tp-dcf-beta tp-dcf-wacc" title={t("WACC_HINT")} aria-label={`${t("WACC")} ${formatWacc(pct)}`}>
        <span className="tp-dcf-unlocked-label">{t("WACC")}</span>
        <span className="tp-dcf-beta-value" dir="ltr">
          {formatWacc(pct)}
        </span>
        <span className="tp-dcf-beta-hint">{t("WACC_LABEL")}</span>
      </aside>
    );
  }

  const spread = roicPct - pct;
  const costShare = Math.max(8, Math.min(92, (pct / roicPct) * 100));
  const edgeShare = 100 - costShare;

  return (
    <aside
      className="tp-dcf-beta tp-dcf-wacc tp-dcf-wacc-earn"
      title={t("WACC_EARN_HINT")}
      aria-label={`${t("ROIC")} ${formatWacc(roicPct)}. ${t("WACC")} ${formatWacc(pct)}. ${t("WACC_VERDICT")}`}
    >
      <div className="tp-dcf-wacc-earn-head">
        <span className="tp-dcf-unlocked-label">{t("WACC")}</span>
        <span className="tp-dcf-wacc-rec">
          <svg className="tp-dcf-wacc-rec-icon" viewBox="0 0 16 16" aria-hidden>
            <circle cx="8" cy="8" r="7" />
            <path d="M4.6 8.2 6.8 10.4 11.4 5.6" />
          </svg>
          {t("WACC_RECOMMENDED")}
        </span>
      </div>

      <div className="tp-dcf-wacc-pair" dir="ltr">
        <div className="tp-dcf-wacc-stat tp-dcf-wacc-stat-roic">
          <span>{t("ROIC")}</span>
          <strong>{formatWacc(roicPct)}</strong>
        </div>
        <span className="tp-dcf-wacc-gt" aria-hidden>
          ›
        </span>
        <div className="tp-dcf-wacc-stat">
          <span>{t("WACC")}</span>
          <strong>{formatWacc(pct)}</strong>
        </div>
      </div>

      <div className="tp-dcf-wacc-meter" aria-hidden>
        <span className="tp-dcf-wacc-meter-fill">
          <span className="tp-dcf-wacc-meter-cost" style={{ width: `${costShare}%` }} />
          <span className="tp-dcf-wacc-meter-edge" style={{ width: `${edgeShare}%` }} />
        </span>
      </div>

      <p className="tp-dcf-wacc-earn-copy">
        <span className="tp-dcf-wacc-spread" dir="ltr">
          {formatPts(spread, lang)}
        </span>
        <span>{t("WACC_VERDICT")}</span>
      </p>
    </aside>
  );
}

function parsePriceToFair(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Same bands as the conclusion: ≤ 0.85 undervalued, through 1.15 fairly valued. */
function priceFairBand(ratio) {
  if (ratio <= 0.85) return "below";
  if (ratio <= 1.15) return "fair";
  return "above";
}

/** Log scale: 0.25× at the left edge, 1× in the center, 4× at the right edge. */
function priceFairGauge(ratio) {
  const steps = Math.log(ratio) / Math.log(2);
  const clamped = Math.max(-2, Math.min(2, steps));
  return ((clamped + 2) / 4) * 100;
}

function formatPriceFair(ratio, lang) {
  return ratio.toLocaleString(lang === "ar" ? "ar" : undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function DcfPriceFairChip({ t, lang, ratio, period, date, loading }) {
  const n = parsePriceToFair(ratio);
  if (!loading && n == null) return null;

  const band = n == null ? "loading" : priceFairBand(n);
  const verdictKey = band === "above" ? "PTFV_ABOVE" : band === "below" ? "PTFV_BELOW" : "PTFV_AT";
  const badgeKey = band === "above" ? "PTFV_BADGE_ABOVE" : band === "below" ? "PTFV_BADGE_BELOW" : "PTFV_BADGE_AT";
  const gauge = n == null ? 50 : priceFairGauge(n);
  const meta = [period, date].filter(Boolean).join(" · ");

  return (
    <aside
      className={`tp-dcf-beta tp-dcf-ptfv tp-dcf-ptfv-${band}`}
      title={t("PTFV_HINT")}
      aria-busy={loading && n == null ? "true" : undefined}
      aria-label={
        n == null
          ? t("PTFV_LABEL")
          : `${t("PTFV_LABEL")} ${formatPriceFair(n, lang)}. ${t(verdictKey)}`
      }
    >
      <div className="tp-dcf-ptfv-head">
        <span className="tp-dcf-unlocked-label">{t("PTFV_LABEL")}</span>
        {n != null ? (
          <span className={`tp-dcf-ptfv-badge tp-dcf-ptfv-badge-${band}`}>
            <svg className="tp-dcf-ptfv-badge-icon" viewBox="0 0 16 16" aria-hidden>
              <circle cx="8" cy="8" r="7" />
              {band === "above" ? (
                <path d="M8 11.6V4.5M5.15 7.15 8 4.3l2.85 2.85" />
              ) : band === "below" ? (
                <path d="M8 4.4v7.1M5.15 8.85 8 11.7l2.85-2.85" />
              ) : (
                <path d="M4.4 6.35h7.2M4.4 9.65h7.2" />
              )}
            </svg>
            {t(badgeKey)}
          </span>
        ) : null}
      </div>

      {n == null ? (
        <span className="tp-dcf-skel-value tp-ptfv-skel" />
      ) : (
        <>
          <div className="tp-dcf-ptfv-value" dir="ltr">
            <strong>{formatPriceFair(n, lang)}</strong>
            <span className="tp-dcf-ptfv-times">×</span>
          </div>

          <div className="tp-dcf-ptfv-gauge" dir="ltr" aria-hidden>
            <span className="tp-dcf-ptfv-track">
              <span className="tp-dcf-ptfv-fairline" />
              <span className="tp-dcf-ptfv-dot" style={{ insetInlineStart: `calc(${gauge}% - 7px)` }} />
            </span>
            <span className="tp-dcf-ptfv-scale">
              <span>0.25×</span>
              <span>{t("PTFV_SCALE_FAIR")}</span>
              <span>4×</span>
            </span>
          </div>

          <p className="tp-dcf-ptfv-copy">{t(verdictKey)}</p>
          {meta ? (
            <p className="tp-dcf-ptfv-meta" dir="ltr">
              {meta}
            </p>
          ) : null}
        </>
      )}
    </aside>
  );
}

function FairValueTile({
  t,
  currency,
  label,
  value,
  price,
  showVsPrice = true,
  loading = false,
  highlight = false,
  emptyHint = "—",
  footer = null,
  pending = false,
  excluded = false,
  excludeReason = null,
}) {
  const n = Number(value);
  const hasValue = Number.isFinite(n);
  const pct = !loading && !pending && !excluded && showVsPrice ? vsPricePct(n, price) : null;
  const className = [
    "tp-fv-tile",
    highlight && !excluded ? "tp-fv-tile-dcf" : "",
    !showVsPrice ? "tp-fv-tile-price" : "",
    excluded ? "tp-fv-tile-excluded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="tp-dcf-unlocked-label">{label}</div>
      {loading ? (
        <div className="tp-dcf-skel-value tp-fv-tile-skel" />
      ) : hasValue ? (
        <>
          <div className="tp-fv-tile-value">
            {fmt2(n)} <span className="tp-dcf-unlocked-ccy">{currency}</span>
          </div>
          {pct != null ? (
            <div className={`tp-dcf-unlocked-pct ${pctClass(pct)}`}>
              {pct > 0 ? "+" : ""}
              {pct.toFixed(1)}% {t("DCF_VS_PRICE")}
            </div>
          ) : null}
        </>
      ) : (
        <div className="tp-fv-tile-empty">{emptyHint}</div>
      )}
      {excluded && excludeReason ? <div className="tp-fv-tile-excluded-reason">{excludeReason}</div> : null}
      {footer}
    </div>
  );
}

function methodNote(methods, key) {
  const row = (methods || []).find((m) => m.key === key);
  if (!row) return { pending: false, excluded: false, reason: null };
  return {
    pending: Boolean(row.pending),
    excluded: Boolean(row.reason) && !row.included,
    reason: row.reason || null,
  };
}

const EXCLUDE_KEY = {
  equity_roe: "FV_EXCL_ROE",
  equity_negative: "FV_EXCL_EQUITY",
  fcf_negative: "FV_EXCL_FCF_NEG",
  fcf_erratic: "FV_EXCL_FCF_ERRATIC",
  earnings_negative: "FV_EXCL_EARNINGS",
};

function lastChartFair(rows) {
  const list = Array.isArray(rows) ? rows : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const n = Number(list[i]?.fairValue);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function StockDcfHero({
  t,
  dir,
  lang = "en",
  currency,
  loading,
  error,
  data,
  livePrice,
  onRetry,
  chartLoading = false,
  chartError = "",
  chartData = null,
  onRetryChart,
  chartWidth = 640,
  beta = null,
  wacc = null,
  roic = null,
  priceToFairValue = null,
  priceToFairLoading = false,
  methods = [],
  fair = null,
  fairLoading = false,
  fairError = "",
  onRetryFair,
}) {
  const dcf = Number(data?.dcf);
  const modelPrice = Number(data?.stockPrice);
  const price = Number.isFinite(Number(livePrice)) ? Number(livePrice) : modelPrice;
  const hasDcf = Number.isFinite(dcf);
  const monthlyPrices = chartData?.monthlyPrices || [];
  const yearlyFairValue = chartData?.yearlyFairValue || [];
  const parsedBeta = parseBeta(beta);
  const parsedWacc = parseWaccPct(wacc);
  const parsedPriceFair = parsePriceToFair(priceToFairValue);
  const metricChips =
    parsedBeta != null || parsedWacc != null || parsedPriceFair != null || priceToFairLoading ? (
      <div className="tp-dcf-metric-chips">
        <DcfBetaChip t={t} beta={parsedBeta} />
        <DcfWaccChip t={t} lang={lang} wacc={parsedWacc} roic={roic} />
        <DcfPriceFairChip
          t={t}
          lang={lang}
          ratio={parsedPriceFair}
          loading={priceToFairLoading}
        />
      </div>
    ) : null;

  const dcfFooter = data?.date ? (
    <div className="tp-dcf-unlocked-date">
      {t("DCF_MODEL_DATE")}: {data.date}
    </div>
  ) : error && onRetry ? (
    <RetryButton onRetry={onRetry} t={t} />
  ) : null;

  let dcfEmptyHint = "—";
  if (error) dcfEmptyHint = error;
  else if (!loading && !hasDcf) dcfEmptyHint = t("DCF_HERO_UNAVAILABLE");

  const lineFair = lastChartFair(yearlyFairValue);
  const liveEv = Number(fair?.fairEV);
  const cardFair = lineFair ?? (Number.isFinite(liveEv) && liveEv > 0 ? liveEv : null);
  const dcfNote = methodNote(methods, "dcf");
  const earningsNote = methodNote(methods, "earnings");
  const equityNote = methodNote(methods, "equity");
  const excludeText = (reason) => (reason && EXCLUDE_KEY[reason] ? t(EXCLUDE_KEY[reason]) : null);

  const chartBlock = (
    <div className="tp-dcf-chart-section">
      <h2 className="tp-dcf-chart-title">{t("FV_CHART_SECTION")}</h2>
      <div className="tp-dcf-chart-wrap" id="tp-dcf-fair-value-chart">
        <div className={`tp-dcf-chart-dcf-box ${dir === "rtl" ? "is-rtl" : ""}`}>
        {cardFair != null ? (
          <>
            <div className="tp-dcf-chart-dcf-label">{t("EV_FAIR_VALUE")}</div>
            <div className="tp-dcf-chart-dcf-value">
              {fmt2(cardFair)} <span>{currency}</span>
            </div>
            <p className="tp-dcf-chart-dcf-hint">{t("FV_CHART_EV_HINT")}</p>
          </>
        ) : (
          <p className="tp-dcf-chart-dcf-hint">{t("FV_CHART_EV_HINT")}</p>
        )}
      </div>

      {chartLoading ? (
        <div className="tp-dcf-chart-loading">
          <div className="tp-dcf-chart-skel" />
          <p>{t("FV_CHART_LOADING")}</p>
        </div>
      ) : chartError ? (
        <div className="tp-dcf-chart-error">
          <p>{chartError}</p>
          {onRetryChart ? <RetryButton onRetry={onRetryChart} t={t} /> : null}
        </div>
      ) : chartData ? (
        <FairValueChart
          monthlyPrices={monthlyPrices}
          yearlyFairValue={yearlyFairValue}
          currency={currency}
          dir={dir}
          lang={lang}
          t={t}
          w={chartWidth}
        />
      ) : (
        <p className="tp-dcf-chart-dcf-hint">{t("FV_CHART_NO_DATA")}</p>
      )}
      </div>
    </div>
  );

  return (
    <section className="tp-dcf-hero" dir={dir} aria-label={t("DCF_HERO_ARIA")}>
      <div className="tp-dcf-hero-glow" aria-hidden />
      <header className="tp-dcf-hero-head">
        <div className="tp-dcf-hero-kicker">
          <span className="tp-dcf-hero-badge">{t("DCF_HERO_BADGE")}</span>
          <span className="tp-dcf-hero-pill">{t("DCF_HERO_PRIMARY")}</span>
        </div>
        <h2 className="tp-dcf-hero-title">{t("DCF_HERO_TITLE")}</h2>
        <p className="tp-dcf-hero-sub">{t("DCF_HERO_SUB")}</p>
      </header>

      <div className="tp-dcf-hero-body">
        <div className="tp-fv-grid">
          <FairValueTile
            t={t}
            currency={currency}
            label={t("CUR_PRICE")}
            value={price}
            showVsPrice={false}
          />
          <FairValueTile
            t={t}
            currency={currency}
            label={t("DCF_FAIR_VALUE")}
            value={dcf}
            price={price}
            loading={loading}
            highlight
            emptyHint={dcfEmptyHint}
            footer={dcfFooter}
            pending={dcfNote.pending}
            excluded={dcfNote.excluded}
            excludeReason={excludeText(dcfNote.reason)}
          />
          <FairValueTile
            t={t}
            currency={currency}
            label={t("EV_FAIR_VALUE")}
            value={fair?.fairEV}
            price={price}
            loading={fairLoading}
            emptyHint={fairError || "—"}
          />
          <FairValueTile
            t={t}
            currency={currency}
            label={t("PS_FAIR_VALUE")}
            value={fair?.fairPS}
            price={price}
            loading={fairLoading}
            emptyHint={fairError || "—"}
          />
          <FairValueTile
            t={t}
            currency={currency}
            label={t("EARNINGS_FAIR_VALUE")}
            value={fair?.fairPE}
            price={price}
            loading={fairLoading}
            emptyHint={fairError || "—"}
            pending={earningsNote.pending}
            excluded={earningsNote.excluded}
            excludeReason={excludeText(earningsNote.reason)}
          />
          <FairValueTile
            t={t}
            currency={currency}
            label={t("EQUITY_FAIR_VALUE")}
            value={fair?.equityPerShare}
            price={price}
            loading={fairLoading}
            emptyHint={fairError || "—"}
            pending={equityNote.pending}
            excluded={equityNote.excluded}
            excludeReason={excludeText(equityNote.reason)}
          />
        </div>

        {fairError && onRetryFair ? (
          <div className="tp-fv-fair-retry">
            <RetryButton onRetry={onRetryFair} t={t} />
          </div>
        ) : null}

        {metricChips}
        {chartBlock}
      </div>
    </section>
  );
}
