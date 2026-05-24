import React, { useMemo } from "react";

export function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtPrice(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function pctClass(n) {
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "tp-us-pos" : "tp-us-neg";
}

export function SectorBars({ rows, t, emptyLabel }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.averageChange - a.averageChange),
    [rows]
  );
  const maxAbs = useMemo(
    () => Math.max(...sorted.map((r) => Math.abs(r.averageChange)), 0.01),
    [sorted]
  );

  if (!sorted.length) {
    return <div className="tp-us-empty">{emptyLabel || t("US_MARKET_NO_DATA")}</div>;
  }

  return (
    <ul className="tp-us-sector-list">
      {sorted.map((row) => {
        const w = (Math.abs(row.averageChange) / maxAbs) * 100;
        const positive = row.averageChange >= 0;
        const label = row.sector || row.industry;
        return (
          <li key={label} className="tp-us-sector-row">
            <div className="tp-us-sector-label" title={label}>
              {label}
            </div>
            <div className="tp-us-sector-bar-wrap">
              <div
                className={`tp-us-sector-bar ${positive ? "up" : "down"}`}
                style={{ width: `${Math.max(w, 4)}%` }}
              />
            </div>
            <div className={`tp-us-sector-pct ${pctClass(row.averageChange)}`}>
              {fmtPct(row.averageChange)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function IndustryList({ rows, t, emptyLabel }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.averageChange - a.averageChange),
    [rows]
  );
  const top = sorted.slice(0, 8);
  const bottom = [...sorted].reverse().slice(0, 8);

  if (!sorted.length) {
    return <div className="tp-us-empty">{emptyLabel || t("US_MARKET_NO_DATA")}</div>;
  }

  return (
    <div className="tp-us-industry-cols">
      <div>
        <h4 className="tp-us-subhead">{t("US_MARKET_INDUSTRY_TOP")}</h4>
        <ul className="tp-us-industry-list">
          {top.map((row) => (
            <li key={`top-${row.industry}`} className="tp-us-industry-item">
              <span className="tp-us-industry-name" title={row.industry}>
                {row.industry}
              </span>
              <span className={`tp-us-industry-pct ${pctClass(row.averageChange)}`}>
                {fmtPct(row.averageChange)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="tp-us-subhead">{t("US_MARKET_INDUSTRY_BOTTOM")}</h4>
        <ul className="tp-us-industry-list">
          {bottom.map((row) => (
            <li key={`bot-${row.industry}`} className="tp-us-industry-item">
              <span className="tp-us-industry-name" title={row.industry}>
                {row.industry}
              </span>
              <span className={`tp-us-industry-pct ${pctClass(row.averageChange)}`}>
                {fmtPct(row.averageChange)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function MoversTable({ rows, onOpen, t, emptyLabel, formatPriceCell }) {
  if (!rows?.length) {
    return <div className="tp-us-empty">{emptyLabel || t("US_MARKET_NO_DATA")}</div>;
  }

  const priceCell = formatPriceCell || ((n) => `$${fmtPrice(n)}`);

  return (
    <div className="tp-us-movers-scroll">
      <table className="tp-us-movers-table">
        <thead>
          <tr>
            <th>{t("TICKER")}</th>
            <th>{t("US_MARKET_COL_NAME")}</th>
            <th className="tp-us-num">{t("PRICE")}</th>
            <th className="tp-us-num">{t("US_MARKET_CHANGE_PCT")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol}>
              <td>
                <button type="button" className="tp-us-ticker-btn" onClick={() => onOpen(row.symbol)}>
                  {row.symbol}
                </button>
              </td>
              <td className="tp-us-name-cell" title={row.name}>
                {row.name}
              </td>
              <td className="tp-us-num">{priceCell(row.price)}</td>
              <td className={`tp-us-num ${pctClass(row.changesPercentage)}`}>
                {fmtPct(row.changesPercentage)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
