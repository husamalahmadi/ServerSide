import React, { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { blogIndexPath } from "../../shared/seo/blogPaths.js";
import { tutorialArticlePath } from "../../shared/seo/tutorialPaths.js";
import { SafeHtml } from "../components/SafeHtml.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { useI18n } from "../i18n.jsx";
import { findBlogPost } from "../services/blogCatalog.js";
import { buildBlogPostSeo } from "../seo/structuredData.js";
import { tutorialHtmlConfig } from "../utils/sanitizeHtml.js";

function formatDate(date, lang) {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function BlogPost() {
  const { t, lang, dir } = useI18n();
  const { slug } = useParams();
  const locale = lang === "ar" ? "ar" : "en";
  const post = useMemo(() => findBlogPost(slug, locale), [slug, locale]);

  const seo = useMemo(() => (post ? buildBlogPostSeo({ post, lang: locale }) : null), [post, locale]);
  usePageMeta(
    seo || {
      pathname: blogIndexPath(locale),
      title: locale === "ar" ? "مدونة TruePrice.Cash" : "TruePrice.Cash Blog",
    }
  );

  if (!post) {
    return <Navigate to={blogIndexPath(locale)} replace />;
  }

  const indexPath = blogIndexPath(locale);
  const tutorialHref = post.relatedTutorial ? tutorialArticlePath(locale, post.relatedTutorial) : "";

  return (
    <article className="tp-page tp-tutorial-article-page" dir={dir} lang={lang}>
      <nav className="tp-tutorial-breadcrumb" aria-label="Breadcrumb">
        <Link to={indexPath}>{t("BLOGS")}</Link>
        <span aria-hidden>/</span>
        <span>{post.title}</span>
      </nav>

      <header className="tp-tutorial-hero">
        {post.seriesLabel ? <p className="tp-tutorial-series-label">{post.seriesLabel}</p> : null}
        <SafeHtml html={post.titleHtml || post.title} tagName="h1" className="tp-tutorial-hero-title" />
        {post.subtitle ? <p className="tp-tutorial-hero-sub">{post.subtitle}</p> : null}
        <div className="tp-tutorial-hero-meta">
          <span>
            <span className="tp-tutorial-meta-label">{t("PUBLISHED")}</span>
            <span className="tp-tutorial-meta-value">{formatDate(post.published, lang)}</span>
          </span>
          {post.readingTime ? (
            <span>
              <span className="tp-tutorial-meta-label">{t("TUTORIALS_META_READING")}</span>
              <span className="tp-tutorial-meta-value">{post.readingTime}</span>
            </span>
          ) : null}
          {post.level ? (
            <span>
              <span className="tp-tutorial-meta-label">{t("TUTORIALS_META_LEVEL")}</span>
              <span className="tp-tutorial-meta-value">{post.level}</span>
            </span>
          ) : null}
        </div>
      </header>

      <div className="tp-card tp-tutorial-body-card">
        <SafeHtml html={post.content} className="tp-tutorial-content" sanitizeConfig={tutorialHtmlConfig} />
        {tutorialHref ? (
          <p style={{ marginTop: "1.25rem" }}>
            <Link to={tutorialHref}>{lang === "ar" ? "تابع في سلسلة الدروس" : "Continue in the tutorial series"}</Link>
          </p>
        ) : null}
      </div>

      <SiteFooter t={t} />
    </article>
  );
}
