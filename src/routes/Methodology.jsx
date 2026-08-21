import React from "react";
import { useI18n } from "../i18n.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { METHODOLOGY_DOCUMENT_TITLE } from "../seo/pageTitles.js";
import { METHODOLOGY_META_DESCRIPTION } from "../seo/pageDescriptions.js";

const SECTIONS = [
  {
    id: "formula",
    headingKey: "METHODOLOGY_FORMULA_HEADING",
    bodyKey: "METHODOLOGY_FORMULA_BODY",
    equationKey: "METHODOLOGY_FORMULA_EQUATION",
  },
  { id: "data", headingKey: "METHODOLOGY_DATA_HEADING", bodyKey: "METHODOLOGY_DATA_BODY" },
  { id: "verdict", headingKey: "METHODOLOGY_VERDICT_HEADING", bodyKey: "METHODOLOGY_VERDICT_BODY" },
  { id: "limits", headingKey: "METHODOLOGY_LIMITS_HEADING", bodyKey: "METHODOLOGY_LIMITS_BODY" },
  {
    id: "independence",
    headingKey: "METHODOLOGY_INDEPENDENCE_HEADING",
    bodyKey: "METHODOLOGY_INDEPENDENCE_BODY",
  },
];

export default function Methodology() {
  const { lang, dir, t } = useI18n();
  usePageMeta({
    documentTitle: METHODOLOGY_DOCUMENT_TITLE[lang] || METHODOLOGY_DOCUMENT_TITLE.en,
    metaDescription: METHODOLOGY_META_DESCRIPTION[lang] || METHODOLOGY_META_DESCRIPTION.en,
    pathname: "/methodology",
  });

  return (
    <div className="tp-page tp-about-page" dir={dir} lang={lang}>
      <PageHeader title={t("METHODOLOGY_TITLE")} subtitle={t("METHODOLOGY_NAV")} />

      <section className="tp-about-hero" aria-label={t("METHODOLOGY_TITLE")}>
        <span className="tp-about-hero-glow" aria-hidden />
        <span className="tp-about-hero-kicker">{t("METHODOLOGY_NAV")}</span>
        <p className="tp-about-hero-lead tp-methodology-lead">{t("METHODOLOGY_INTRO")}</p>
        <nav className="tp-about-nav" aria-label={t("METHODOLOGY_NAV")}>
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="tp-about-nav-link">
              {t(section.headingKey)}
            </a>
          ))}
        </nav>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="tp-about-section">
          <div className="tp-about-section-head">
            <h2 className="tp-about-section-title">{t(section.headingKey)}</h2>
            {section.equationKey ? (
              <p className="tp-methodology-equation">{t(section.equationKey)}</p>
            ) : null}
            <p className="tp-about-body">{t(section.bodyKey)}</p>
          </div>
        </section>
      ))}

      <SiteFooter t={t} />
    </div>
  );
}
