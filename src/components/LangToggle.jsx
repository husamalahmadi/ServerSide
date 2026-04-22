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
        border: "none",
        borderBottom: "1px solid transparent",
        borderRadius: 0,
        padding: "2px 0",
        fontWeight: 500,
        background: "transparent",
        color: "var(--tp-link, #4b5563)",
        cursor: "pointer",
        flex: "0 0 auto",
        fontSize: 14,
      }}
    >
      {active ? t("AR") : t("EN")}
    </button>
  );
}
