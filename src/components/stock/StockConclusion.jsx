import React, { useMemo } from "react";
import { conclusionCopy } from "../../../shared/stockConclusion.js";

const CHECK_LABEL = {
  roic: "INVEST_CHECK_ROIC",
  rev: "INVEST_CHECK_REV",
  op: "INVEST_CHECK_OP",
  net: "INVEST_CHECK_NET",
  fcf: "INVEST_CHECK_FCF",
  debt: "INVEST_CHECK_DEBT",
};

const OWNER_SHORT = {
  en: { invest_add: "Add", hold: "Hold", hold_dont_add: "Hold", hold_review: "Review" },
  ar: { invest_add: "أضف", hold: "أبقِ", hold_dont_add: "أبقِ", hold_review: "راجع" },
};

const BUYER_SHORT = {
  en: { invest: "Invest", wait: "Wait", wait_trap: "Wait" },
  ar: { invest: "استثمر", wait: "انتظر", wait_trap: "انتظر" },
};

/** Same bands as stockConclusion.js: ≤ 0.85 undervalued, through 1.15 fairly valued. */
const GAUGE_MIN = 0.45;
const GAUGE_MAX = 1.75;
const ENTRY_RATIO = 0.85;
const FAIR_RATIO = 1.15;

function gaugePercent(ratio) {
  const clamped = Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, ratio));
  return ((clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 100;
}

const ZONE_ENTRY = gaugePercent(ENTRY_RATIO);
const ZONE_FAIR = gaugePercent(FAIR_RATIO);

function ownerTone(owners) {
  if (owners === "invest_add") return "good";
  if (owners === "hold_review") return "bad";
  return "hold";
}

function buyerTone(buyers) {
  if (buyers === "invest") return "good";
  if (buyers === "wait_trap") return "bad";
  return "hold";
}

function valuationTone(valuation) {
  if (valuation === "undervalued") return "good";
  if (valuation === "overvalued") return "bad";
  return "hold";
}

function qualityTone(quality) {
  if (quality?.pass) return "good";
  if (!quality?.roicPass) return "bad";
  if ((quality?.score ?? 0) >= 4) return "warn";
  return "bad";
}

function formatEarningsDate(iso, lang) {
  const day = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(lang === "ar" ? "ar" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    numberingSystem: "latn",
  });
}

function formatMoney(n, currency) {
  if (n == null || n === "") return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const body = x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${body} ${currency}` : body;
}

function checkDetail(check) {
  if (check.key === "roic" && check.roicPct != null && check.waccPct != null) {
    return `${check.roicPct.toFixed(2)}% vs ${check.waccPct.toFixed(2)}%`;
  }
  if (check.key === "debt" && check.netDebtToEbitda != null) {
    return `${check.netDebtToEbitda.toFixed(2)}×`;
  }
  return null;
}

function confidenceNote(sentence, lang) {
  if (!sentence) return null;
  const sep = lang === "ar" ? "، " : ", ";
  const idx = sentence.indexOf(sep);
  if (idx === -1) return sentence;
  const rest = sentence.slice(idx + sep.length).replace(/\.$/, "");
  if (!rest) return sentence;
  if (lang === "ar") return rest;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function splitNarrative(body) {
  const text = String(body || "").trim();
  if (!text) return [];
  const lead = text.match(/^(.{24,}?\.)\s+([\s\S]+)$/);
  if (!lead) return [text];
  return [lead[1], ...lead[2].split(/(?<=\.)\s+/).filter(Boolean)];
}

function markerEdge(pct) {
  if (pct < 10) return "is-start";
  if (pct > 90) return "is-end";
  return "";
}

function Pip({ met }) {
  return (
    <span className={`tp-brief-pip ${met ? "is-met" : "is-miss"}`} aria-hidden>
      {met ? (
        <svg viewBox="0 0 16 16">
          <path d="M3.5 8.2 6.4 11l6.1-6.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      )}
    </span>
  );
}

function Decision({ tone, kicker, headline, detail }) {
  return (
    <div className={`tp-brief-decision tp-brief-decision-${tone}`}>
      <span className="tp-brief-kicker">{kicker}</span>
      <strong className="tp-brief-decision-value">{headline}</strong>
      {detail ? <span className="tp-brief-decision-detail">{detail}</span> : null}
    </div>
  );
}

export function StockConclusionPending({ t }) {
  return (
    <div className="tp-brief tp-brief-pending" aria-busy="true">
      <span className="tp-sr-only">{t("LOADING")}</span>
      <div className="tp-brief-decisions">
        <div className="tp-brief-skel tp-brief-skel-decision" />
        <div className="tp-brief-skel tp-brief-skel-decision" />
      </div>
      <div className="tp-brief-skel tp-brief-skel-panel" />
      <div className="tp-brief-skel tp-brief-skel-line" />
      <div className="tp-brief-skel tp-brief-skel-line tp-brief-skel-line-short" />
    </div>
  );
}

export function StockConclusion({ t, lang, currency, company, conclusion, earningsDate }) {
  const earningsLabel = formatEarningsDate(earningsDate, lang);
  const copy = useMemo(
    () => conclusionCopy(conclusion, { lang, company, currency, earningsLabel }),
    [conclusion, lang, company, currency, earningsLabel]
  );
  const checks = conclusion?.quality?.checks || [];
  const score = conclusion?.quality?.score ?? 0;
  const total = conclusion?.quality?.total || checks.length || 6;
  const qTone = qualityTone(conclusion?.quality);
  const ring = 2 * Math.PI * 28;
  const dash = total ? (score / total) * ring : 0;
  const ratio = Number.isFinite(conclusion?.ratio) ? conclusion.ratio : null;
  const mark = ratio == null ? null : gaugePercent(ratio);
  const vTone = valuationTone(conclusion?.valuation);
  const sentences = copy.body ? splitNarrative(copy.body) : [];
  const note = confidenceNote(copy.confidence, lang);
  const ownerFull = conclusion?.owners ? t(`INVEST_OWNER_${conclusion.owners}`) : "";
  const buyerFull = conclusion?.buyers ? t(`INVEST_BUYER_${conclusion.buyers}`) : "";
  const ownerShort = OWNER_SHORT[lang]?.[conclusion?.owners] || ownerFull;
  const buyerShort = BUYER_SHORT[lang]?.[conclusion?.buyers] || buyerFull;
  const showActions =
    conclusion?.entryPrice != null || conclusion?.medianDisplay != null || conclusion?.confidence?.band;

  return (
    <div className="tp-brief">
      {conclusion?.owners ? (
        <div className="tp-brief-decisions">
          <Decision
            tone={ownerTone(conclusion.owners)}
            kicker={t("INVEST_OWNER")}
            headline={ownerShort}
            detail={ownerFull !== ownerShort ? ownerFull : null}
          />
          <Decision
            tone={buyerTone(conclusion.buyers)}
            kicker={t("INVEST_BUYER")}
            headline={buyerShort}
            detail={buyerFull !== buyerShort ? buyerFull : null}
          />
        </div>
      ) : copy.verdict ? (
        <div className="tp-brief-decision tp-brief-decision-hold">
          <strong className="tp-brief-decision-value">{copy.verdict}</strong>
        </div>
      ) : null}

      <section
        className="tp-brief-panel"
        aria-label={copy.valuationLine || t("INVEST_VALUATION_NA")}
        style={{ "--zone-entry": `${ZONE_ENTRY}%`, "--zone-fair": `${ZONE_FAIR}%` }}
      >
        <div className="tp-brief-panel-head">
          <span className="tp-brief-kicker">{t("WATCHLIST_VS_FV")}</span>
          {conclusion?.valuation ? (
            <span className={`tp-brief-pill tp-brief-pill-${vTone}`}>
              {conclusion.valuation === "undervalued"
                ? t("WATCHLIST_UNDERVALUED")
                : conclusion.valuation === "overvalued"
                  ? t("WATCHLIST_OVERVALUED")
                  : t("INVEST_FAIR")}
            </span>
          ) : (
            <span className="tp-brief-pill">{t("INVEST_VALUATION_NA")}</span>
          )}
        </div>

        {conclusion?.valuation && conclusion.premiumPct != null ? (
          <p className={`tp-brief-gap tp-brief-gap-${vTone}`}>
            <strong dir="ltr">
              {conclusion.valuation === "fair"
                ? `${conclusion.ratioDisplay != null ? conclusion.ratioDisplay.toFixed(2) : "1.00"}×`
                : `${Math.abs(conclusion.premiumPct)}%`}
            </strong>
            <span>
              {conclusion.valuation === "undervalued"
                ? t("INVEST_BELOW_FV")
                : conclusion.valuation === "overvalued"
                  ? t("INVEST_ABOVE_FV")
                  : t("INVEST_AT_FV")}
            </span>
          </p>
        ) : null}

        <div
          className={`tp-brief-scale${mark == null ? " is-empty" : ""}`}
        >
          {mark != null ? (
            <span
              className={`tp-brief-marker tp-brief-marker-${vTone} ${markerEdge(mark)}`}
              style={{ "--mark": `${mark}%` }}
            >
              <span className="tp-brief-marker-label" dir="ltr">
                {conclusion.ratioDisplay != null ? `${conclusion.ratioDisplay.toFixed(2)}×` : ""}
              </span>
              <span className="tp-brief-marker-dot" />
            </span>
          ) : null}
        </div>
        <div className="tp-brief-zones" aria-hidden>
          <span>{t("WATCHLIST_UNDERVALUED")}</span>
          <span>{t("INVEST_FAIR")}</span>
          <span>{t("WATCHLIST_OVERVALUED")}</span>
        </div>

        <div className="tp-brief-pair">
          <div>
            <span className="tp-brief-kicker">{t("CUR_PRICE")}</span>
            <strong dir="ltr">{formatMoney(conclusion?.price, currency)}</strong>
          </div>
          <div>
            <span className="tp-brief-kicker">{t("INVEST_MEDIAN_FV")}</span>
            <strong dir="ltr">{formatMoney(conclusion?.medianDisplay, currency)}</strong>
          </div>
          {conclusion?.applicableCount > 0 ? (
            <div>
              <span className="tp-brief-kicker">{t("INVEST_ABOVE_PRICE")}</span>
              <strong dir="ltr">
                {conclusion.aboveCount}/{conclusion.applicableCount}
              </strong>
            </div>
          ) : null}
        </div>
      </section>

      {checks.length ? (
        <section className="tp-brief-panel tp-brief-quality" aria-label={copy.qualityLine || t("INVEST_QUALITY_GATE")}>
          <div className="tp-brief-score">
            <div className={`tp-brief-ring tp-brief-ring-${qTone}`}>
              <svg viewBox="0 0 72 72" aria-hidden>
                <circle className="tp-brief-ring-track" cx="36" cy="36" r="28" />
                <circle
                  className="tp-brief-ring-value"
                  cx="36"
                  cy="36"
                  r="28"
                  strokeDasharray={`${dash} ${ring}`}
                  transform="rotate(-90 36 36)"
                />
              </svg>
              <div className="tp-brief-ring-label" dir="ltr">
                <strong>{score}</strong>
                <em>/{total}</em>
              </div>
            </div>
            <span className={`tp-brief-pill tp-brief-pill-${qTone}`}>
              {conclusion?.quality?.pass ? t("INVEST_QUALITY_PASS") : t("INVEST_QUALITY_FAIL")}
            </span>
            {!conclusion?.quality?.pass && score >= 5 && !conclusion?.quality?.roicPass ? (
              <p className="tp-brief-roic-note">{t("INVEST_ROIC_REQUIRED")}</p>
            ) : (
              <span className="tp-brief-kicker">{t("INVEST_QUALITY_GATE")}</span>
            )}
          </div>
          <ul className="tp-brief-checks">
            {checks.map((check) => {
              const detail = checkDetail(check);
              return (
                <li key={check.key} className={check.met ? "is-met" : "is-miss"}>
                  <div className="tp-brief-check-top">
                    <Pip met={check.met} />
                    <span className="tp-brief-check-status">{t(check.met ? "INVEST_MET" : "INVEST_MISS")}</span>
                  </div>
                  <span className="tp-brief-check-name">{t(CHECK_LABEL[check.key] || check.key)}</span>
                  {detail ? (
                    <span className="tp-brief-check-detail" dir="ltr">
                      {detail}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {sentences.length ? (
        <div className="tp-brief-narrative">
          {sentences.map((sentence, index) => (
            <p key={index} className={index === 0 ? "tp-brief-lead" : undefined}>
              {sentence}
            </p>
          ))}
        </div>
      ) : null}

      {copy.excluded ? <p className="tp-brief-excluded">{copy.excluded}</p> : null}

      {showActions ? (
        <div className="tp-brief-actions">
          {conclusion?.entryPrice != null ? (
            <div className="tp-brief-action">
              <span className="tp-brief-kicker">{t("INVEST_ENTRY_ZONE")}</span>
              <strong dir="ltr">{formatMoney(conclusion.entryPrice, currency)}</strong>
              <p>
                {t("INVEST_OR_BELOW")}
                {copy.entryAlt ? <span>{copy.entryAlt}</span> : null}
              </p>
            </div>
          ) : null}
          {conclusion?.medianDisplay != null ? (
            <div className="tp-brief-action">
              <span className="tp-brief-kicker">{t("INVEST_RECHECK")}</span>
              <strong>{earningsLabel || t("INVEST_AFTER_EARNINGS")}</strong>
            </div>
          ) : null}
          {conclusion?.confidence?.band ? (
            <div className={`tp-brief-action tp-brief-action-${conclusion.confidence.band}`}>
              <span className="tp-brief-kicker">{t("INVEST_CONFIDENCE")}</span>
              <strong>{t(`INVEST_CONFIDENCE_${String(conclusion.confidence.band).toUpperCase()}`)}</strong>
              {note ? <p>{note}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
