import React from "react";
import { Link } from "react-router-dom";

/**
 * Pill-styled link used for nav (Blogs, About, Contact, etc.)
 */
export function PillLink({ to, children, ariaLabel, className = "" }) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={`tp-pill ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
