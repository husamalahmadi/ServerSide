import React from "react";

export function RetryButton({ onRetry, t }) {
  return (
    <button
      type="button"
      onClick={() => onRetry?.()}
      style={{
        display: "block",
        marginTop: 12,
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid #b91c1c",
        background: "#fef2f2",
        color: "#991b1b",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {t?.("RETRY_MSG") ?? "Try again"}
    </button>
  );
}
