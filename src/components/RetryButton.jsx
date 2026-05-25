import React from "react";

export function RetryButton({ onRetry, t }) {
  return (
    <button type="button" className="tp-btn-retry" onClick={() => onRetry?.()}>
      {t?.("RETRY_MSG") ?? "Try again"}
    </button>
  );
}
