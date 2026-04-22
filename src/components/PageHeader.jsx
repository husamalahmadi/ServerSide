import React from "react";
import { Link } from "react-router-dom";
import { UserBar } from "./UserBar.jsx";

const headerStyle = {
  borderBottom: "1px solid var(--tp-border, #e5e7eb)",
  padding: "18px 0 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  position: "relative",
  zIndex: 1,
};

const mastheadStyle = { lineHeight: 1 };
const mastheadTitleStyle = {
  fontFamily: "'Barlow', 'Inter', sans-serif",
  fontSize: "clamp(24px, 3.2vw, 34px)",
  fontWeight: 800,
  letterSpacing: "-0.5px",
  color: "var(--tp-ink, #111827)",
};
const mastheadSubStyle = {
  fontSize: 11,
  letterSpacing: "1.2px",
  textTransform: "uppercase",
  color: "var(--tp-muted, #8a8578)",
  marginTop: 5,
};
const headerRightStyle = { textAlign: "right" };
const editionStyle = {
  fontSize: 11,
  letterSpacing: "0.2px",
  color: "var(--tp-muted, #8a8578)",
  lineHeight: 1.8,
};

/**
 * Shared page header: TruePrice.Cash brand + nav links.
 */
export function PageHeader({ title, subtitle, children }) {
  return (
    <header style={headerStyle}>
      <div style={mastheadStyle}>
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={mastheadTitleStyle}>{title || "TruePrice.Cash"}</div>
        </Link>
        {subtitle != null && subtitle !== "" ? (
          <div style={mastheadSubStyle}>{subtitle}</div>
        ) : null}
      </div>
      <div style={{ ...headerRightStyle, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <UserBar />
          {children}
        </div>
        <div style={editionStyle}>US · TASI · Stock Fair Value</div>
      </div>
    </header>
  );
}
