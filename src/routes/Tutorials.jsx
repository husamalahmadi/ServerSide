import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { TUTORIAL_ARTICLES } from "../data/tutorials/articles.js";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { buildTutorialsIndexSeo } from "../seo/structuredData.js";
import { stripHtmlToText } from "../utils/sanitizeHtml.js";

function stripTitle(html) {
  return stripHtmlToText(String(html || "").replace(/<br\s*\/?>/gi, " "));
}

export default function Tutorials() {
  const seo = useMemo(() => buildTutorialsIndexSeo({ articles: TUTORIAL_ARTICLES }), []);
  usePageMeta(seo);

  return (
    <div className="tp-page tp-tutorials-page">
      <header className="tp-tutorial-landing-hero">
        <p className="tp-tutorial-series-label">Fundamental Analysis Series</p>
        <h1 className="tp-tutorial-landing-title">
          Learn to invest with <em>fundamentals</em>
        </h1>
        <p className="tp-tutorial-landing-lead">
          Ten step-by-step guides — from reading financial statements to spotting red flags — written for
          serious long-term investors on US, TASI, Tokyo, and London markets.
        </p>
        <div className="tp-tutorial-landing-stats">
          <span>{TUTORIAL_ARTICLES.length} tutorials</span>
          <span aria-hidden>·</span>
          <span>Beginner to advanced</span>
          <span aria-hidden>·</span>
          <span>English</span>
        </div>
      </header>

      <ol className="tp-tutorial-catalog">
        {TUTORIAL_ARTICLES.map((article) => (
          <li key={article.slug}>
            <Link to={`/tutorials/${article.slug}`} className="tp-tutorial-catalog-card">
              <div className="tp-tutorial-catalog-num">{String(article.order).padStart(2, "0")}</div>
              <div className="tp-tutorial-catalog-body">
                <h2 className="tp-tutorial-catalog-title">{stripTitle(article.titleHtml)}</h2>
                <p className="tp-tutorial-catalog-sub">{article.subtitle}</p>
                <div className="tp-tutorial-catalog-meta">
                  {article.readingTime ? <span>{article.readingTime} read</span> : null}
                  {article.level ? <span>{article.level}</span> : null}
                </div>
              </div>
              <span className="tp-tutorial-catalog-arrow" aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ol>

      <SiteFooter />
    </div>
  );
}
