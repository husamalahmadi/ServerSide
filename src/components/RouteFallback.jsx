import React from "react";

/** Lightweight placeholder while lazy routes load (does not affect route logic). */
export function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--tp-muted, #8a8578)",
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  );
}
