import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { blogIndexPath, blogPostPath } from "../../shared/seo/blogPaths.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { SafeHtml } from "../components/SafeHtml.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { useI18n } from "../i18n.jsx";
import { loadBlogPosts } from "../services/blogCatalog.js";
import { buildBlogPostSeo } from "../seo/structuredData.js";
import { blogHtmlConfig } from "../utils/sanitizeHtml.js";

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
  const [state, setState] = useState({ loading: true, error: "", post: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", post: null });
    loadBlogPosts()
      .then((posts) => {
        if (cancelled) return;
        const post = posts.find((item) => item.locale === locale && item.slug === slug) || null;
        setState({ loading: false, error: "", post });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, error: err?.message || t("ERR_LOAD_BLOGS"), post: null });
      });
    return () => {
      cancelled = true;
    };
  }, [locale, slug, t]);

  const seo = useMemo(
    () => (state.post ? buildBlogPostSeo({ post: state.post, lang: locale }) : null),
    [state.post, locale]
  );
  usePageMeta(
    seo || {
      pathname: blogPostPath(locale, slug),
      title: locale === "ar" ? "مدونة TruePrice.Cash" : "TruePrice.Cash Blog",
    }
  );

  const indexPath = blogIndexPath(locale);

  return (
    <div className="tp-page" dir={dir} lang={lang} style={{ maxWidth: 900 }}>
      <div className="tp-container" style={{ padding: 16 }}>
        <PageHeader
          title={state.post?.title || t("BLOGS")}
          subtitle={
            state.post
              ? [formatDate(state.post.published, lang), state.post.author].filter(Boolean).join(" · ")
              : lang === "ar"
                ? "مدونات استثمارية"
                : "Investing insights & market notes"
          }
        />
        <p style={{ marginTop: 0 }}>
          <Link to={indexPath}>{lang === "ar" ? "كل المقالات" : "All posts"}</Link>
        </p>
        {state.loading ? (
          <div style={{ color: "#64748b" }}>Loading…</div>
        ) : state.error ? (
          <div style={{ color: "#8b1a1a" }}>{state.error}</div>
        ) : !state.post ? (
          <div style={{ color: "#8a8578" }}>{t("NO_DATA")}</div>
        ) : (
          <article className="tp-card" style={{ background: "#fff", borderRadius: 16, padding: 16 }}>
            <SafeHtml html={state.post.content} sanitizeConfig={blogHtmlConfig} />
          </article>
        )}
        <SiteFooter t={t} />
      </div>
    </div>
  );
}
