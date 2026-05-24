import React from "react";

export function fmtPrice(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function SaMoversTable({ rows, onOpen, t, emptyLabel, formatPriceCell }) {
  if (!rows?.length) {
    return <div className="tp-us-empty">{emptyLabel || t("US_MARKET_NO_DATA")}</div>;
  }

  const priceCell = formatPriceCell || ((n) => `${fmtPrice(n)} SAR`);

  return (
    <div className="tp-us-movers-scroll">
      <table className="tp-us-movers-table">
        <thead>
          <tr>
            <th>{t("TICKER")}</th>
            <th>{t("US_MARKET_COL_NAME")}</th>
            <th className="tp-us-num">{t("PRICE")}</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
