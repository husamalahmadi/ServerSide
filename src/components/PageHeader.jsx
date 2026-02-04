import React from "react";

const headerStyle = {
  borderRadius: 18,
  background: "linear-gradient(180deg, #0f172a, #111827)",
  padding: "14px 16px",
  color: "#fff",
  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
  flexWrap: "wrap",
  minWidth: 0,
};

/**
 * Shared page header: brand (title + optional subtitle) + actions slot.
 */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div style={headerStyle}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
        {subtitle != null && subtitle !== "" ? (
          <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 2 }}>{subtitle}</div>
        ) : null}
      </div>
      <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}
