import React from "react";
import { fmt2, fmtBill } from "../../domain/formatting.js";

function SortTh({ id, label, sortBy, sortDir, onSort }) {
  const active = sortBy === id;
  return (
    <th
      onClick={() => onSort(id)}
      style={{ cursor: "pointer" }}
      className={id === "pe" || id === "marketCap" || id === "discountPct" ? "tp-scr-num" : ""}
    >
      {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

export function ScreenerResultsTable({ t, items, sortBy, sortDir, onSort, onOpenTicker }) {
  return (
    <div className="tp-scr-table-wrap">
      <table className="tp-scr-table">
        <thead>
          <tr>
            <SortTh id="ticker" label={t("TICKER")} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortTh id="name" label={t("COMPANIES")} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortTh id="market" label={t("SCREENER_MARKET")} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortTh id="sector" label={t("SECTOR")} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortTh id="pe" label="P/E" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortTh id="marketCap" label={t("SCREENER_MARKETCAP")} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortTh id="discountPct" label={t("SCREENER_FV_DISCOUNT")} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={`${it.market}-${it.ticker}`}>
              <td className="tp-scr-ticker-cell">
                <button type="button" className="tp-scr-link" onClick={() => onOpenTicker(it.ticker)}>
                  {it.ticker}
                </button>
              </td>
              <td className="tp-scr-company-cell">{it.name}</td>
              <td>
                <span className={`tp-scr-market-badge ${it.market === "sa" ? "sa" : "us"}`}>
                  {it.market === "sa" ? "TASI" : "US"}
                </span>
              </td>
              <td className="tp-scr-sector-cell">{it.sector}</td>
              <td className="tp-scr-num">{fmt2(it.pe)}</td>
              <td className="tp-scr-num">{fmtBill(it.marketCap)}</td>
              <td className={`tp-scr-num ${it.discountPct >= 0 ? "tp-scr-pos" : "tp-scr-neg"}`}>
                {it.discountPct == null ? "—" : `${fmt2(it.discountPct)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
