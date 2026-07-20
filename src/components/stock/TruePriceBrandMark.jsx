import React from "react";

/** Site logo mark used in print/PDF report chrome (matches sidebar TP badge). */
export function TruePriceBrandMark({ size = 36, showWordmark = true, compact = false, className = "" }) {
  return (
    <div className={`tp-brand-mark${compact ? " tp-brand-mark--compact" : ""} ${className}`.trim()}>
      <span
        className="tp-brand-mark-icon"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
        aria-hidden
      >
        TP
      </span>
      {showWordmark ? (
        <span className="tp-brand-mark-text">
          <span className="tp-brand-mark-title">TruePrice.Cash</span>
          {!compact ? <span className="tp-brand-mark-tag">US · TASI · Tokyo · LSE</span> : null}
        </span>
      ) : null}
    </div>
  );
}
