import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { TUTORIAL_ARTICLES } from "../data/tutorials/articles.js";
import { resolveTutorialArticles } from "../data/tutorials/resolve.js";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { buildTutorialsIndexSeo } from "../seo/structuredData.js";
import { stripHtmlToText } from "../utils/sanitizeHtml.js";
import { useI18n } from "../i18n.jsx";
import {
  tutorialArticlePath,
  useTutorialLocale,
} from "../hooks/useTutorialLocale.js";

function stripTitle(html) {
  return stripHtmlToText(String(html || "").replace(/<br\s*\/?>/gi, " "));
}

export default function Tutorials() {
  const { t } = useI18n();
  const locale = useTutorialLocale();
  const articles = useMemo(
    () => resolveTutorialArticles(TUTORIAL_ARTICLES, locale),
    [locale]
  );
  const seo = useMemo(() => buildTutorialsIndexSeo({ articles, lang: locale }), [articles, locale]);
  usePageMeta(seo);

  return (
    <div className="tp-page tp-tutorials-page">
      <header className="tp-tutorial-landing-hero">
        <p className="tp-tutorial-series-label">{t("TUTORIALS_SERIES_LABEL")}</p>
        <h1 className="tp-tutorial-landing-title">
          {locale === "ar" ? (
            <>
              تعلّم الاستثمار عبر <em>التحليل الأساسي</em>
            </>
          ) : (
            <>
              Learn to invest with <em>fundamentals</em>
            </>
          )}
        </h1>
        <p className="tp-tutorial-landing-lead">{t("TUTORIALS_HERO_LEAD")}</p>
        <div className="tp-tutorial-landing-stats">
          <span>
            {TUTORIAL_ARTICLES.length} {t("TUTORIALS_COUNT_LABEL")}
          </span>
          <span aria-hidden>·</span>
          <span>{t("TUTORIALS_LEVEL_RANGE")}</span>
        </div>
      </header>

      <ol className="tp-tutorial-catalog">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link to={tutorialArticlePath(locale, article.slug)} className="tp-tutorial-catalog-card">
              <div className="tp-tutorial-catalog-num">{String(article.order).padStart(2, "0")}</div>
              <div className="tp-tutorial-catalog-body">
                <h2 className="tp-tutorial-catalog-title">{stripTitle(article.titleHtml)}</h2>
                <p className="tp-tutorial-catalog-sub">{article.subtitle}</p>
                <div className="tp-tutorial-catalog-meta">
                  {article.readingTime ? (
                    <span>
                      {article.readingTime} {t("TUTORIALS_READ_SUFFIX")}
                    </span>
                  ) : null}
                  {article.level ? <span>{article.level}</span> : null}
                </div>
              </div>
              <span className="tp-tutorial-catalog-arrow" aria-hidden>
                {locale === "ar" ? "←" : "→"}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <SiteFooter t={t} />
    </div>
  );
}
