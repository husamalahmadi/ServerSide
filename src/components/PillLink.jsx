import React from "react";
import { Link } from "react-router-dom";

const pillStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 700,
  background: "#ffffff",
  color: "#111827",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/**
 * Pill-styled link used for nav (Trueprice.cash, Dashboard, About, etc.)
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
