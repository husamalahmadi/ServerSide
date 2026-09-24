import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { SiteFooter } from "../components/SiteFooter.jsx";

export default function NotFound() {
  const { t, lang, dir } = useI18n();
  const { pathname } = useLocation();

  usePageMeta({
    title: t("NOT_FOUND_TITLE"),
    description: t("NOT_FOUND_BODY"),
    pathname,
  });

  useEffect(() => {
    let el = document.querySelector('meta[name="robots"]');
    const previous = el?.getAttribute("content") || "";
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "robots");
      document.head.appendChild(el);
    }
    el.setAttribute("content", "noindex");
    return () => {
      if (previous) el.setAttribute("content", previous);
    };
  }, []);

  return (
    <div className="tp-page" dir={dir} lang={lang}>
      <header className="tp-page-header">
        <h1 className="tp-page-title">{t("NOT_FOUND_TITLE")}</h1>
        <p className="tp-page-sub">{t("NOT_FOUND_BODY")}</p>
        <p>
          <Link to="/">{t("FOOTER_HOME")}</Link>
        </p>
      </header>
      <SiteFooter t={t} />
    </div>
  );
}
