import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { SafeHtml } from "../components/SafeHtml.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { buildBlogPostSeo } from "../seo/structuredData.js";
import { getBlogPostBySlug, getBlogPostsByLang, blogPostPath } from "../data/blogPosts.js";
import { BLOG_HTML_CONFIG } from "../utils/sanitizeHtml.js";

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
          back: "← Back to all posts",
          related: "More from the blog",
          source: "Original on Blogger",
        },
        ar: {
          back: "← العودة إلى جميع المقالات",
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

  return (
    <div className="tp-page tp-blog-post-page" dir={dir} lang={postLang}>
      <div className="tp-blog-container">
        {state.loading ? (
          <div className="tp-blog-loading">{uiLang === "ar" ? "جاري التحميل…" : "Loading…"}</div>
        ) : post ? (
          <>
            <nav className="tp-blog-post-nav" aria-label={L.back}>
              <Link to={`/blogs?lang=${postLang}`} className="tp-blog-back-link">
                {L.back}
              </Link>
            </nav>

            <article className="tp-blog-article-wrap">
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
