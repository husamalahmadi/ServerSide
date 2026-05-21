import React from "react";
import { Link } from "react-router-dom";

/**
 * In-page title block (global nav lives in AppShell).
 */
export function PageHeader({ title, subtitle }) {
  return (
    <header className="tp-page-header">
      <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
        <h1 className="tp-page-title">{title || "TruePrice.Cash"}</h1>
      </Link>
      {subtitle != null && subtitle !== "" ? (
        <p className="tp-page-sub">{subtitle}</p>
      ) : null}
    </header>
  );
}
