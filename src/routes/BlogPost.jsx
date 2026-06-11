import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { SafeHtml } from "../components/SafeHtml.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { buildBlogPostSeo } from "../seo/structuredData.js";
import { getBlogPostBySlug, getBlogPostsByLang, blogPostPath } from "../data/blogPosts.js";
import { stripHtmlToText, BLOG_HTML_CONFIG } from "../utils/sanitizeHtml.js";

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

function readingMinutes(html) {
  const words = stripHtmlToText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export default function BlogPost() {
  const { slug } = useParams();
  const { t, lang: uiLang } = useI18n();
  const [state, setState] = useState({ loading: true, post: null, related: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const post = await getBlogPostBySlug(slug);
        if (cancelled) return;
        if (!post) {
          setState({ loading: false, post: null, related: [] });
          return;
        }
        const siblings = await getBlogPostsByLang(post.lang);
        const related = siblings.filter((p) => p.slug !== post.slug).slice(0, 3);
        setState({ loading: false, post, related });
      } catch {
        if (!cancelled) setState({ loading: false, post: null, related: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const postLang = state.post?.lang === "ar" ? "ar" : "en";
  const dir = postLang === "ar" ? "rtl" : "ltr";
  const L = useMemo(
    () =>
      ({
        en: {
          kicker: "TruePrice.Cash Investing Blog",
          back: "← Back to all posts",
          published: "Published",
          updated: "Updated",
          readTime: "min read",
          related: "More from the blog",
          source: "Original on Blogger",
        },
        ar: {
          kicker: "مدونة TruePrice.Cash للاستثمار",
          back: "← العودة إلى جميع المقالات",
          published: "نُشر",
          updated: "آخر تحديث",
          readTime: "دقيقة قراءة",
          related: "مقالات أخرى",
          source: "النص الأصلي على Blogger",
        },
      })[postLang],
    [postLang]
  );

  const seo = useMemo(() => {
    if (!state.post) return null;
    return buildBlogPostSeo({ post: state.post, lang: postLang });
  }, [state.post, postLang]);

  usePageMeta(seo || {});

  if (!state.loading && !state.post) {
    return <Navigate to={`/blogs?lang=${uiLang}`} replace />;
  }

  const post = state.post;
  const readMins = post ? readingMinutes(post.content) : 0;

  return (
    <div className="tp-page tp-blog-post-page" dir={dir} lang={postLang}>
      <div className="tp-blog-container">
        <PageHeader
          title={post?.title || t("BLOGS")}
          subtitle={postLang === "ar" ? "مدونة استثمارية" : "Investing insights & market notes"}
        />

        {state.loading ? (
          <div className="tp-blog-loading">{uiLang === "ar" ? "جاري التحميل…" : "Loading…"}</div>
        ) : post ? (
          <>
            <article className="tp-blog-article-wrap">
              <header className="tp-blog-article-hero">
                <span className="tp-blog-hero-glow" aria-hidden />
                <span className="tp-blog-hero-kicker">{L.kicker}</span>
                <SafeHtml html={post.titleHtml || post.title} tagName="h1" className="tp-blog-article-title" />
                <div className="tp-blog-article-meta">
                  <time dateTime={post.published}>{formatDate(post.published, postLang)}</time>
                  {post.author ? <span>{post.author}</span> : null}
                  <span>
                    {readMins} {L.readTime}
                  </span>
                </div>
                {post.heroImage ? (
                  <div className="tp-blog-hero-image-wrap">
                    <img src={post.heroImage} alt="" className="tp-blog-hero-image" loading="eager" />
                  </div>
                ) : null}
              </header>

              <div className="tp-blog-article-body">
                <SafeHtml
                  html={post.content}
                  tagName="div"
                  className="tp-blog-prose"
                  sanitizeConfig={BLOG_HTML_CONFIG}
                />
              </div>

              <footer className="tp-blog-article-footer">
                <Link to={`/blogs?lang=${postLang}`} className="tp-blog-back-link">
                  {L.back}
                </Link>
                {post.sourceUrl ? (
                  <a
                    href={post.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tp-blog-source-link"
                  >
                    {L.source}
                  </a>
                ) : null}
              </footer>
            </article>

            {state.related.length > 0 ? (
              <section className="tp-blog-related" aria-label={L.related}>
                <h2 className="tp-blog-related-title">{L.related}</h2>
                <div className="tp-blog-related-grid">
                  {state.related.map((r) => (
                    <Link key={r.slug} to={blogPostPath(r.slug)} className="tp-blog-related-card">
                      <SafeHtml html={r.titleHtml || r.title} tagName="h3" className="tp-blog-related-card-title" />
                      <p className="tp-blog-related-card-date">{formatDate(r.published, postLang)}</p>
                      <p className="tp-blog-related-card-excerpt">{r.excerpt}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        <SiteFooter t={t} />
      </div>
    </div>
  );
}
