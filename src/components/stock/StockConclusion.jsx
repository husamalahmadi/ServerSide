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

function tone(owners, buyers) {
  if (buyers === "invest") return "good";
  if (owners === "hold_review" || buyers === "wait_trap") return "bad";
  return "hold";
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

function checkDetail(check) {
  if (check.key === "roic" && check.roicPct != null && check.waccPct != null) {
    return `${check.roicPct.toFixed(2)}% vs ${check.waccPct.toFixed(2)}%`;
  }
  if (check.key === "debt" && check.netDebtToEbitda != null) {
    return `${check.netDebtToEbitda.toFixed(2)}×`;
  }
  return null;
}

export function StockConclusion({ t, lang, currency, company, conclusion, earningsDate }) {
  const earningsLabel = formatEarningsDate(earningsDate, lang);
  const copy = useMemo(
    () => conclusionCopy(conclusion, { lang, company, currency, earningsLabel }),
    [conclusion, lang, company, currency, earningsLabel]
  );
  const verdictTone = tone(conclusion?.owners, conclusion?.buyers);

  return (
    <div className="tp-conclusion">
      {copy.verdict ? (
        <div className={`tp-conclusion-verdict tp-conclusion-${verdictTone}`}>{copy.verdict}</div>
      ) : null}

      {conclusion?.owners ? (
        <div className="tp-conclusion-lines">
          <div className="tp-conclusion-line">
            <span>{t("INVEST_OWNER")}</span>
            <strong>{t(`INVEST_OWNER_${conclusion.owners}`)}</strong>
          </div>
          <div className="tp-conclusion-line">
            <span>{t("INVEST_BUYER")}</span>
            <strong>{t(`INVEST_BUYER_${conclusion.buyers}`)}</strong>
          </div>
        </div>
      ) : null}

      <div className="tp-conclusion-stats">
        {copy.qualityLine ? <span>{copy.qualityLine}</span> : null}
        {copy.valuationLine ? <span>{copy.valuationLine}</span> : null}
        {copy.medianLine ? <span>{copy.medianLine}</span> : null}
      </div>

      <div>
        <div className="tp-conclusion-kicker">{t("INVEST_QUALITY_GATE")}</div>
        <ul className="tp-conclusion-checks">
          {(conclusion?.quality?.checks || []).map((check) => {
            const detail = checkDetail(check);
            return (
              <li key={check.key}>
                <span className={check.met ? "is-met" : "is-miss"}>{check.met ? "✓" : "✗"}</span>
                <span>{t(CHECK_LABEL[check.key] || check.key)}</span>
                {detail ? (
                  <span className="tp-conclusion-detail" dir="ltr">
                    {detail}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {copy.excluded ? <p className="tp-conclusion-excluded">{copy.excluded}</p> : null}
      {copy.body ? <p className="tp-conclusion-body">{copy.body}</p> : null}

      {copy.entry || copy.recheck || copy.confidence ? (
        <div className="tp-conclusion-meta">
          {copy.entry ? <div>{copy.entry}</div> : null}
          {copy.entryAlt ? <div>{copy.entryAlt}</div> : null}
          {copy.recheck ? <div>{copy.recheck}</div> : null}
          {copy.confidence ? <div>{copy.confidence}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
