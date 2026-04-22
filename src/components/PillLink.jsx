import React from "react";
import { Link } from "react-router-dom";

const pillStyle = {
  border: "none",
  borderRadius: 0,
  padding: "2px 0",
  fontWeight: 500,
  background: "transparent",
  color: "var(--tp-link, #4b5563)",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: "'Inter', 'Barlow', sans-serif",
  fontSize: 14,
  letterSpacing: "0",
  borderBottom: "1px solid transparent",
  transition: "color 0.15s, border-color 0.15s",
};

/**
 * Pill-styled link used for nav (TruePrice.Cash, Dashboard, About, etc.)
 */
export function PillLink({ to, children, ariaLabel, className }) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={className || "tp-nav-link"}
      style={pillStyle}
    >
      {children}
    </Link>
  );
}
