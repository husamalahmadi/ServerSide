import React, { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { TUTORIAL_BY_SLUG } from "../data/tutorials/articles.js";
import { SafeHtml } from "../components/SafeHtml.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { TutorialArticleNav } from "../components/tutorial/TutorialArticleNav.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { buildTutorialArticleSeo } from "../seo/structuredData.js";
import { tutorialHtmlConfig } from "../utils/sanitizeHtml.js";
import { useI18n } from "../i18n.jsx";

export default function TutorialArticle() {
  const { t } = useI18n();
  const { slug } = useParams();
  const article = TUTORIAL_BY_SLUG[slug];

  const seo = useMemo(
    () => (article ? buildTutorialArticleSeo({ article }) : null),
    [article]
  );
  usePageMeta(seo || {});

  if (!article) {
    return <Navigate to="/tutorials" replace />;
  }

  return (
    <article className="tp-page tp-tutorial-article-page">
      <nav className="tp-tutorial-breadcrumb" aria-label="Breadcrumb">
        <Link to="/tutorials">Tutorials</Link>
        <span aria-hidden>/</span>
        <span>Tutorial {String(article.order).padStart(2, "0")}</span>
      </nav>

      <header className="tp-tutorial-hero">
        {article.seriesLabel ? (
          <p className="tp-tutorial-series-label">{article.seriesLabel}</p>
        ) : null}
        <SafeHtml
          html={article.titleHtml}
          tagName="h1"
          className="tp-tutorial-hero-title"
        />
        {article.subtitle ? (
          <p className="tp-tutorial-hero-sub">{article.subtitle}</p>
        ) : null}
        <div className="tp-tutorial-hero-meta">
          {article.readingTime ? (
            <span>
              <span className="tp-tutorial-meta-label">Reading time</span>
              <span className="tp-tutorial-meta-value">{article.readingTime}</span>
            </span>
          ) : null}
          {article.level ? (
            <span>
              <span className="tp-tutorial-meta-label">Level</span>
              <span className="tp-tutorial-meta-value">{article.level}</span>
            </span>
          ) : null}
          {article.series ? (
            <span>
              <span className="tp-tutorial-meta-label">Series</span>
              <span className="tp-tutorial-meta-value">{article.series}</span>
            </span>
          ) : null}
        </div>
      </header>

      <div className="tp-card tp-tutorial-body-card">
        <SafeHtml
          html={article.bodyHtml}
          className="tp-tutorial-content"
          sanitizeConfig={tutorialHtmlConfig}
        />
      </div>

      <TutorialArticleNav prev={article.prev} next={article.next} />
      <SiteFooter t={t} />
    </article>
  );
}
