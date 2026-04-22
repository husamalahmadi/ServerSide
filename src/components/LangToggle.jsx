import React from "react";

export function LangToggle({ lang, onToggle, t }) {
  const active = lang === "ar";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label="Toggle language"
      title="Toggle language"
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 999,
        padding: "6px 10px",
        fontWeight: 700,
        background: "#ffffff",
        color: "#111827",
        cursor: "pointer",
        flex: "0 0 auto",
      }}
    >
      {active ? t("AR") : t("EN")}
    </button>
  );
}
