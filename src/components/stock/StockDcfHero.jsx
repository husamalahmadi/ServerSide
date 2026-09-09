import React, { useRef } from "react";
import { CompareBar } from "./StockCharts.jsx";
import { FairValueChart } from "./FairValueChart.jsx";
import { GoogleGIcon } from "../GoogleGIcon.jsx";
import { RetryButton } from "../RetryButton.jsx";
import { fmt2 } from "../../domain/formatting.js";

function pctClass(n) {
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "tp-dcf-pos" : "tp-dcf-neg";
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

function isWaccOpportunity(price, fairValue) {
  const p = Number(price);
  const fv = Number(fairValue);
  return Number.isFinite(p) && p > 0 && Number.isFinite(fv) && fv > 0 && p < fv;
}

function DcfWaccChip({ t, wacc, opportunity }) {
  const pct = parseWaccPct(wacc);
  if (pct == null) return null;
  return (
    <aside
      className={`tp-dcf-beta tp-dcf-wacc${opportunity ? " tp-dcf-wacc-hot" : ""}`}
      title={t("WACC_HINT")}
      aria-label={`${t("WACC")} ${formatWacc(pct)}${opportunity ? `. ${t("WACC_OPPORTUNITY")}` : ""}`}
    >
      <span className="tp-dcf-unlocked-label">{t("WACC")}</span>
      <span className="tp-dcf-beta-value" dir="ltr">
        {formatWacc(pct)}
      </span>
      <span className="tp-dcf-beta-hint">{t("WACC_LABEL")}</span>
    </aside>
  );
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
  user,
  onSignIn,
  onRetry,
  signInBusy,
  chartLoading = false,
  chartError = "",
  chartData = null,
  onRetryChart,
  chartWidth = 640,
  beta = null,
  wacc = null,
  waccFairValue = null,
}) {
  const signInLock = useRef(false);

  const handleSignIn = () => {
    if (signInLock.current) return;
    signInLock.current = true;
    onSignIn?.();
  };

  const locked = data?.locked === true;
  const dcf = locked ? null : Number(data?.dcf);
  const modelPrice = Number(data?.stockPrice);
  const price = Number.isFinite(Number(livePrice)) ? Number(livePrice) : modelPrice;
  let discountPct = null;
  if (!locked && Number.isFinite(dcf) && Number.isFinite(price) && price > 0) {
    discountPct = ((dcf - price) / price) * 100;
  }
  const hasDcf = locked ? Boolean(data?.hasDcf) : Number.isFinite(dcf);
  const showChart = chartLoading || chartError || chartData;
  const monthlyPrices = chartData?.monthlyPrices || [];
  const yearlyFairValue = chartData?.yearlyFairValue || [];
  const parsedBeta = parseBeta(beta);
  const parsedWacc = parseWaccPct(wacc);
  const opportunity = isWaccOpportunity(price, waccFairValue);
  const metricChips =
    parsedBeta != null || parsedWacc != null ? (
      <div className="tp-dcf-metric-chips">
        <DcfBetaChip t={t} beta={parsedBeta} />
        <DcfWaccChip t={t} wacc={parsedWacc} opportunity={opportunity} />
      </div>
    ) : null;
  const opportunityBanner = opportunity ? (
    <div className="tp-dcf-opportunity" role="status">
      <span className="tp-dcf-opportunity-badge">{t("WACC_OPPORTUNITY")}</span>
      <p className="tp-dcf-opportunity-copy">{t("WACC_OPPORTUNITY_COPY")}</p>
    </div>
  ) : null;

  const chartBlock = showChart ? (
    <div className="tp-dcf-chart-wrap" id="tp-dcf-fair-value-chart">
      <div className={`tp-dcf-chart-dcf-box ${dir === "rtl" ? "is-rtl" : ""}`}>
        {locked ? (
          <>
            <div className="tp-dcf-chart-dcf-lock">{t("DCF_HERO_HIDDEN")}</div>
            <p className="tp-dcf-chart-dcf-hint">{t("DCF_CHART_DIRECTION_LOCKED")}</p>
            <button
              type="button"
              className="tp-signin-google tp-dcf-chart-signin"
              onClick={handleSignIn}
              disabled={signInBusy}
            >
              <GoogleGIcon size={14} />
              {t("DCF_HERO_SIGNIN")}
            </button>
          </>
        ) : Number.isFinite(dcf) ? (
          <>
            <div className="tp-dcf-chart-dcf-row">
              <div>
                <div className="tp-dcf-chart-dcf-label">{t("DCF_FAIR_VALUE")}</div>
                <div className="tp-dcf-chart-dcf-value">
                  {fmt2(dcf)} <span>{currency}</span>
                </div>
              </div>
              {parsedBeta != null ? (
                <div className="tp-dcf-chart-beta">
                  <span className="tp-dcf-chart-dcf-label">{t("BETA")}</span>
                  <span className="tp-dcf-chart-beta-value" dir="ltr">β {formatBeta(parsedBeta)}</span>
                </div>
              ) : null}
              {parsedWacc != null ? (
                <div className="tp-dcf-chart-beta">
                  <span className="tp-dcf-chart-dcf-label">{t("WACC")}</span>
                  <span className="tp-dcf-chart-beta-value" dir="ltr">{formatWacc(parsedWacc)}</span>
                </div>
              ) : null}
            </div>
            <p className="tp-dcf-chart-dcf-hint">{t("DCF_CHART_DIRECTION")}</p>
          </>
        ) : (
          <p className="tp-dcf-chart-dcf-hint">{t("DCF_CHART_DIRECTION")}</p>
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
      ) : (
        <FairValueChart
          monthlyPrices={monthlyPrices}
          yearlyFairValue={yearlyFairValue}
          currency={currency}
          dir={dir}
          lang={lang}
          t={t}
          w={chartWidth}
        />
      )}
    </div>
  ) : null;

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

      {loading ? (
        <div className="tp-dcf-hero-body tp-dcf-hero-loading">
          <div className="tp-dcf-headline">
            <div>
              <div className="tp-dcf-skel-value" />
              <p>{t("DCF_HERO_LOADING")}</p>
            </div>
            {metricChips}
          </div>
          {opportunityBanner}
          {chartBlock}
        </div>
      ) : error ? (
        <div className="tp-dcf-hero-body tp-dcf-hero-error">
          <div className="tp-dcf-headline">
            <div>
              <p>{error}</p>
              {onRetry ? <RetryButton onRetry={onRetry} t={t} /> : null}
            </div>
            {metricChips}
          </div>
          {opportunityBanner}
        </div>
      ) : !hasDcf ? (
        <div className="tp-dcf-hero-body tp-dcf-hero-empty">
          <div className="tp-dcf-headline">
            <p>{t("DCF_HERO_UNAVAILABLE")}</p>
            {metricChips}
          </div>
          {opportunityBanner}
          {chartBlock}
        </div>
      ) : locked ? (
        <div className="tp-dcf-hero-body tp-dcf-hero-locked">
          <div className="tp-dcf-locked-grid">
            <div className="tp-dcf-locked-main">
              <div className="tp-dcf-headline">
                <div>
                  <div className="tp-dcf-locked-label">{t("DCF_FAIR_VALUE")}</div>
                  <div className="tp-dcf-locked-blur" aria-hidden>
                    <span className="tp-dcf-locked-mask">●●●.●●</span>
                  </div>
                </div>
                {metricChips}
              </div>
              {opportunityBanner}
              <div className="tp-dcf-locked-hint">{t("DCF_HERO_LOCKED_HINT")}</div>
              <ul className="tp-dcf-locked-list">
                <li>{t("DCF_HERO_LOCKED_ITEM1")}</li>
                <li>{t("DCF_HERO_LOCKED_ITEM2")}</li>
                <li>{t("DCF_HERO_LOCKED_ITEM3")}</li>
              </ul>
              <button
                type="button"
                className="tp-signin-google tp-dcf-signin"
                onClick={handleSignIn}
                disabled={signInBusy}
              >
                <GoogleGIcon size={14} />
                {t("DCF_HERO_SIGNIN")}
              </button>
            </div>
            <div className="tp-dcf-locked-aside">
              <div className="tp-dcf-teaser-stat">
                <span className="tp-dcf-teaser-label">{t("CUR_PRICE")}</span>
                <span className="tp-dcf-teaser-value">
                  {Number.isFinite(price) ? `${fmt2(price)} ${currency}` : "—"}
                </span>
              </div>
              <div className="tp-dcf-teaser-stat tp-dcf-teaser-muted">
                <span className="tp-dcf-teaser-label">{t("DCF_FAIR_VALUE")}</span>
                <span className="tp-dcf-teaser-lock">{t("DCF_HERO_HIDDEN")}</span>
              </div>
              <p className="tp-dcf-teaser-copy">{t("DCF_HERO_TEASER")}</p>
            </div>
          </div>
          {chartBlock}
        </div>
      ) : (
        <div className="tp-dcf-hero-body tp-dcf-hero-unlocked">
          <div className="tp-dcf-unlocked-grid">
            <div className="tp-dcf-unlocked-main">
              <div className="tp-dcf-headline">
                <div>
                  <div className="tp-dcf-unlocked-label">{t("DCF_FAIR_VALUE")}</div>
                  <div className="tp-dcf-unlocked-value">
                    {fmt2(dcf)} <span className="tp-dcf-unlocked-ccy">{currency}</span>
                  </div>
                  {Number.isFinite(discountPct) ? (
                    <div className={`tp-dcf-unlocked-pct ${pctClass(discountPct)}`}>
                      {discountPct > 0 ? "+" : ""}
                      {discountPct.toFixed(1)}% {t("DCF_VS_PRICE")}
                    </div>
                  ) : null}
                  {data?.date ? (
                    <div className="tp-dcf-unlocked-date">
                      {t("DCF_MODEL_DATE")}: {data.date}
                    </div>
                  ) : null}
                </div>
                {metricChips}
              </div>
              {opportunityBanner}
            </div>
            <div className="tp-dcf-unlocked-aside">
              <CompareBar
                current={price ?? 0}
                fair={dcf}
                currency={currency}
                dir={dir}
                t={t}
                fairLabel={t("DCF_FAIR_VALUE")}
              />
              <p className="tp-dcf-unlocked-note">{t("DCF_HERO_UNLOCKED_NOTE")}</p>
            </div>
          </div>
          {chartBlock}
        </div>
      )}
    </section>
  );
}
