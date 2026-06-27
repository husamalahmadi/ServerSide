import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../i18n.jsx";

/** Locale from /:locale/tutorials routes; syncs site language. */
export function useTutorialLocale() {
  const { locale: routeLocale } = useParams();
  const { lang, setLang } = useI18n();
  const locale = routeLocale === "ar" || routeLocale === "en" ? routeLocale : lang;

  useEffect(() => {
    if (routeLocale === "ar" || routeLocale === "en") {
      setLang(routeLocale);
    }
  }, [routeLocale, setLang]);

  return locale;
}

export function tutorialIndexPath(locale) {
  return `/${locale === "ar" ? "ar" : "en"}/tutorials`;
}

export function tutorialArticlePath(locale, slug) {
  return `/${locale === "ar" ? "ar" : "en"}/tutorials/${encodeURIComponent(slug)}`;
}
