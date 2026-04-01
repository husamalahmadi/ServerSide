import React from "react";
import { Link } from "react-router-dom";
import { UserBar } from "./UserBar.jsx";

const headerStyle = {
  borderBottom: "2px solid var(--tp-ink, #1a1a14)",
  padding: "20px 0 16px",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  position: "relative",
  zIndex: 1,
};

const mastheadStyle = { lineHeight: 1 };
const mastheadTitleStyle = {
  fontFamily: "'Playfair Display', serif",
  fontSize: "clamp(28px, 4vw, 44px)",
  fontWeight: 900,
  letterSpacing: "-1px",
  color: "var(--tp-accent, #1a3a2a)",
};
const mastheadSubStyle = {
  fontSize: 10,
  letterSpacing: "4px",
  textTransform: "uppercase",
  color: "var(--tp-muted, #8a8578)",
  marginTop: 4,
};
const headerRightStyle = { textAlign: "right" };
const editionStyle = {
  fontSize: 10,
  letterSpacing: "2px",
  textTransform: "uppercase",
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
