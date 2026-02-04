import React from "react";

export function Card({ title, children, style }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#fff",
        marginBottom: 16,
        boxShadow: "0 1px 10px rgba(0,0,0,0.04)",
        overflow: "hidden",
        ...style,
      }}
    >
      {title ? (
        <header
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 900,
            color: "#111827",
          }}
        >
          {title}
        </header>
      ) : null}
      <div style={{ padding: 14, minWidth: 0 }}>{children}</div>
    </section>
  );
}
