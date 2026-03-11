import React from "react";

export function Card({ title, children, style }) {
  return (
    <section
      style={{
        border: "1px solid var(--tp-border, #ddd8cc)",
        borderRadius: 16,
        background: "var(--tp-surface, #fff)",
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
            borderBottom: "1px solid var(--tp-border, #ddd8cc)",
            fontWeight: 900,
            color: "var(--tp-ink, #1a1a14)",
            fontFamily: "'Playfair Display', serif",
          }}
        >
          {title}
        </header>
      ) : null}
      <div style={{ padding: 14, minWidth: 0 }}>{children}</div>
    </section>
  );
}
