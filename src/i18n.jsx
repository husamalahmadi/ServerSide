// FILE: client/src/i18n.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import dictEn from "./locales/en.js";

const I18nContext = createContext(null);

const STORAGE_KEY = "lang";

function getInitialLang() {
  if (typeof window === "undefined") return "en";
  try {
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang === "ar" || urlLang === "en") return urlLang;
  } catch {
    /* ignore invalid URL */
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "ar" || stored === "en") return stored;
  const browser = navigator.language || navigator.userLanguage || "";
  return /^ar/i.test(browser) ? "ar" : "en";
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);
  const [dictAr, setDictAr] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    if (lang !== "ar" || dictAr != null) return;
    import("./locales/ar.js").then((m) => setDictAr(m.default)).catch(() => setDictAr(dictEn));
  }, [lang, dictAr]);

  const t = useMemo(() => {
    const current = lang === "ar" && dictAr ? dictAr : dictEn;
    return (key) => current[key] ?? dictEn[key] ?? key;
  }, [lang, dictAr]);

  const value = useMemo(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t,
      setLang,
      toggleLang: () => setLang((p) => (p === "en" ? "ar" : "en")),
    }),
    [lang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const defaultI18n = {
  lang: "en",
  dir: "ltr",
  t: (key) => key,
  setLang: () => {},
  toggleLang: () => {},
};

export function useI18n() {
  const ctx = useContext(I18nContext);
  return ctx ?? defaultI18n;
}
