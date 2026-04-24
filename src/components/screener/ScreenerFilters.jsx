import React from "react";
import { fmtBill } from "../../domain/formatting.js";

export function ScreenerFilters({ t, filters, setFilters, sectors }) {
  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="tp-scr-filters">
      <div className="tp-scr-row">
        <label>{t("SCREENER_MARKET")}</label>
        <select value={filters.market} onChange={(e) => update("market", e.target.value)}>
          <option value="all">{t("SCREENER_ALL_MARKETS")}</option>
          <option value="us">{t("MARKET_US")}</option>
          <option value="sa">{t("MARKET_SA")}</option>
        </select>
      </div>
      <div className="tp-scr-row">
        <label>{t("SECTOR")}</label>
        <select value={filters.sector} onChange={(e) => update("sector", e.target.value)}>
          <option value="all">{t("INDUSTRY_ALL")}</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="tp-scr-row">
        <label>{t("SEARCH")}</label>
        <input
          value={filters.query}
          onChange={(e) => update("query", e.target.value)}
          placeholder={t("SCREENER_SEARCH_PLACEHOLDER")}
        />
      </div>
      <div className="tp-scr-row">
        <label>{t("SCREENER_PE_RANGE")}</label>
        <div className="tp-scr-inline">
          <input type="number" value={filters.peMin} onChange={(e) => update("peMin", Number(e.target.value || 0))} />
          <span>→</span>
          <input type="number" value={filters.peMax} onChange={(e) => update("peMax", Number(e.target.value || 0))} />
        </div>
      </div>
      <div className="tp-scr-row">
        <label>{t("SCREENER_MARKETCAP_RANGE")}</label>
        <div className="tp-scr-inline">
          <input
            type="number"
            value={filters.marketCapMin}
            onChange={(e) => update("marketCapMin", Number(e.target.value || 0))}
          />
          <span>→</span>
          <input
            type="number"
            value={filters.marketCapMax}
            onChange={(e) => update("marketCapMax", Number(e.target.value || 0))}
          />
        </div>
        <small>
          {fmtBill(filters.marketCapMin)} - {fmtBill(filters.marketCapMax)}
        </small>
      </div>
      <div className="tp-scr-row">
        <label>{t("SCREENER_DISCOUNT_RANGE")}</label>
        <div className="tp-scr-inline">
          <input
            type="number"
            value={filters.discountMin}
            onChange={(e) => update("discountMin", Number(e.target.value || 0))}
          />
          <span>→</span>
          <input
            type="number"
            value={filters.discountMax}
            onChange={(e) => update("discountMax", Number(e.target.value || 0))}
          />
        </div>
      </div>
    </div>
  );
}
