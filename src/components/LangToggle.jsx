import React from "react";

export function LangToggle({ lang, onToggle, t }) {
  const active = lang === "ar";
  return (
    <button
      type="button"
      className="tp-lang-toggle"
      onClick={onToggle}
      aria-pressed={active}
      aria-label="Toggle language"
      title="Toggle language"
    >
      {active ? t("AR") : t("EN")}
    </button>
  );
}
