import React from "react";

export function StatCard({ label, value, delta, deltaHint, chart, foot }) {
  const deltaClass =
    delta == null ? "" : Number(delta) >= 0 ? "up" : "down";
  return (
    <div className="tp-stat-card">
      <div className="tp-stat-card-head">
        <span className="tp-stat-label">{label}</span>
        {chart}
      </div>
      <div className="tp-stat-value">{value}</div>
      {delta != null && (
        <div className={`tp-stat-delta ${deltaClass}`}>
          {Number(delta) >= 0 ? "+" : ""}
          {delta}
          {deltaHint ? ` ${deltaHint}` : ""}
        </div>
      )}
      {foot ? <div className="tp-stat-foot">{foot}</div> : null}
    </div>
  );
}
