import React from "react";
import { TruePriceBrandMark } from "./TruePriceBrandMark.jsx";
import { fmt2 } from "../../domain/formatting.js";

export function StockReportPrintShell({
  t,
  dir,
  ticker,
  companyName,
  industry,
  reportDate,
  price,
  fairAvg,
  currency,
  logoUrl,
  reportUrl,
}) {
  const upside =
    Number.isFinite(Number(price)) && Number(price) > 0 && Number.isFinite(Number(fairAvg))
      ? ((Number(fairAvg) - Number(price)) / Number(price)) * 100
      : null;

  return (
    <div className="tp-report-print-chrome" dir={dir} aria-hidden="true">
      <header className="tp-print-running-header">
        <TruePriceBrandMark size={28} compact />
        <div className="tp-print-running-meta">
          <span className="tp-print-running-type">{t("PRINT_REPORT_TYPE")}</span>
          <span className="tp-print-running-date">
            {t("REPORT_DATE")}: {reportDate}
          </span>
        </div>
      </header>

      <section className="tp-print-cover">
        <div className="tp-print-cover-brand">
          <TruePriceBrandMark size={44} />
          <div className="tp-print-cover-doc">
            <div className="tp-print-cover-kicker">{t("PRINT_REPORT_TYPE")}</div>
            <div className="tp-print-cover-site">trueprice.cash</div>
          </div>
        </div>

        <div className="tp-print-cover-main">
          {logoUrl ? (
            <img
              className="tp-print-cover-logo"
              src={logoUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="tp-print-cover-headings">
            <h1 className="tp-print-cover-title">{companyName || ticker}</h1>
            {industry ? <p className="tp-print-cover-industry">{industry}</p> : null}
            <p className="tp-print-cover-ticker">
              {t("TICKER")}: <strong>{ticker}</strong>
            </p>
          </div>
        </div>

        <div className="tp-print-cover-metrics">
          <div className="tp-print-metric">
            <span className="tp-print-metric-label">{t("PRICE")}</span>
            <span className="tp-print-metric-value">
              {price == null ? t("NOT_AVAILABLE") : `${fmt2(price)} ${currency}`}
            </span>
          </div>
          <div className="tp-print-metric">
            <span className="tp-print-metric-label">{t("FAIR_AVG")}</span>
            <span className="tp-print-metric-value">
              {fairAvg == null ? t("NOT_AVAILABLE") : `${fmt2(fairAvg)} ${currency}`}
            </span>
          </div>
          <div className="tp-print-metric">
            <span className="tp-print-metric-label">{t("PRINT_VS_FAIR")}</span>
            <span
              className={`tp-print-metric-value${
                upside == null ? "" : upside >= 0 ? " tp-print-metric-value--pos" : " tp-print-metric-value--neg"
              }`}
            >
              {upside == null ? t("NOT_AVAILABLE") : `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%`}
            </span>
          </div>
          <div className="tp-print-metric">
            <span className="tp-print-metric-label">{t("REPORT_DATE")}</span>
            <span className="tp-print-metric-value">{reportDate}</span>
          </div>
        </div>
      </section>

      <footer className="tp-print-running-footer">
        <span>{t("PRINT_GENERATED_BY")}</span>
        <span>{reportUrl}</span>
        <span>{t("PRINT_FOOTER_DISCLAIMER")}</span>
      </footer>
    </div>
  );
}
