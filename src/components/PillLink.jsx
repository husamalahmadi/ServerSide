import React from "react";
import { Link } from "react-router-dom";

const pillStyle = {
  border: "1px solid var(--tp-border, #ddd8cc)",
  borderRadius: 999,
  padding: "6px 12px",
  fontWeight: 700,
  background: "var(--tp-surface, #fff)",
  color: "var(--tp-ink, #1a1a14)",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  letterSpacing: "1px",
};

/**
 * Pill-styled link used for nav (TruePrice.Cash, Dashboard, About, etc.)
 */
export function PillLink({ to, children, ariaLabel, className }) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={className}
      style={pillStyle}
    >
      {children}
    </Link>
  );
}
