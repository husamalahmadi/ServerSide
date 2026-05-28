import React, { useRef } from "react";
import { CompareBar } from "./StockCharts.jsx";
import { GoogleGIcon } from "../GoogleGIcon.jsx";
import { RetryButton } from "../RetryButton.jsx";
import { fmt2 } from "../../domain/formatting.js";

function pctClass(n) {
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "tp-dcf-pos" : "tp-dcf-neg";
}

export function StockDcfHero({
  t,
  dir,
  currency,
  loading,
  error,
  data,
  livePrice,
  user,
  onSignIn,
  onRetry,
  signInBusy,
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
          <div className="tp-dcf-skel-value" />
          <p>{t("DCF_HERO_LOADING")}</p>
        </div>
      ) : error ? (
        <div className="tp-dcf-hero-body tp-dcf-hero-error">
          <p>{error}</p>
          {onRetry ? <RetryButton onRetry={onRetry} t={t} /> : null}
        </div>
      ) : !hasDcf ? (
        <div className="tp-dcf-hero-body tp-dcf-hero-empty">
          <p>{t("DCF_HERO_UNAVAILABLE")}</p>
        </div>
      ) : locked ? (
        <div className="tp-dcf-hero-body tp-dcf-hero-locked">
          <div className="tp-dcf-locked-grid">
            <div className="tp-dcf-locked-main">
              <div className="tp-dcf-locked-label">{t("DCF_FAIR_VALUE")}</div>
              <div className="tp-dcf-locked-blur" aria-hidden>
                <span className="tp-dcf-locked-mask">●●●.●●</span>
              </div>
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
        </div>
      ) : (
        <div className="tp-dcf-hero-body tp-dcf-hero-unlocked">
          <div className="tp-dcf-unlocked-grid">
            <div className="tp-dcf-unlocked-main">
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
        </div>
      )}
    </section>
  );
}
