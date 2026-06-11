// FILE: src/routes/Blogs.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { stripHtmlToText } from "../utils/sanitizeHtml.js";
import { SafeHtml } from "../components/SafeHtml.jsx";
import { buildBlogsSeo } from "../seo/structuredData.js";
import { getBlogPostsByLang, blogPostPath } from "../data/blogPosts.js";

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

function truncateText(text, maxLength = 150) {
  const clean = stripHtmlToText(text);
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength).trim() + "…";
}

function groupPostsByDate(posts) {
  const grouped = {};
  posts.forEach((post) => {
    if (!post.published) return;
    const date = new Date(post.published);
    const year = date.getFullYear();
    const month = date.getMonth();

    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = [];
    grouped[year][month].push(post);
  });

  Object.keys(grouped).forEach((year) => {
    const months = Object.keys(grouped[year]).map(Number).sort((a, b) => b - a);
    const sorted = {};
    months.forEach((month) => {
      sorted[month] = grouped[year][month];
    });
    grouped[year] = sorted;
  });

  return grouped;
}

function getMonthName(monthIndex, lang) {
  const months = {
    en: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
    ar: [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ],
  };
  return months[lang]?.[monthIndex] || months.en[monthIndex] || "";
}

export default function Blogs() {
  const { t, lang, dir } = useI18n();
  const [state, setState] = useState({
    loading: true,
    error: "",
    posts: [],
  });
  const [selectedSlug, setSelectedSlug] = useState(null);

  const heroCopy = useMemo(
    () =>
      lang === "ar"
        ? {
            kicker: "رؤى أسواق واستثمار",
            title: "مدونة TruePrice.Cash",
            lead: "تحليلات أسبوعية عن أسواق أمريكا والسعودية واليابان — قراءة الأرباح، التقييم، والفرص التي يهمّ المستثمر معرفتها.",
          }
        : {
            kicker: "Markets & investing insights",
            title: "TruePrice.Cash Blog",
            lead: "Weekly commentary on US, TASI, Tokyo, and London markets — earnings reads, valuation context, and ideas for individual investors.",
          },
    [lang]
  );

  const postsForSeo = useMemo(
    () =>
      state.posts.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title || stripHtmlToText(p.titleHtml || ""),
        url: blogPostPath(p.slug),
        published: p.published,
        updated: p.updated,
        author: p.author || "",
      })),
    [state.posts]
  );

  const seo = useMemo(() => buildBlogsSeo({ lang, posts: postsForSeo }), [lang, postsForSeo]);
  usePageMeta(seo);

  const loadBlogs = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true, error: "" }));
      const posts = await getBlogPostsByLang(lang);
      setState({ loading: false, error: "", posts });
    } catch (e) {
      const errorMsg = e?.message || String(e) || t("ERR_LOAD_BLOGS");
      setState({
        loading: false,
        error: `${t("ERR_LOAD_BLOGS")} (${errorMsg})`,
        posts: [],
      });
    }
  }, [lang, t]);

  useEffect(() => {
    loadBlogs();
  }, [loadBlogs]);

  const groupedPosts = groupPostsByDate(state.posts);
  const years = Object.keys(groupedPosts).map(Number).sort((a, b) => b - a);

  return (
    <div className="tp-page tp-blog-page" dir={dir} lang={lang}>
      <div className="tp-blog-container">
        <PageHeader
          title={t("BLOGS")}
          subtitle={lang === "ar" ? "مدونات استثمارية" : "Investing insights & market notes"}
        />

        <section className="tp-blog-hero" aria-label={heroCopy.title}>
          <span className="tp-blog-hero-glow" aria-hidden />
          <span className="tp-blog-hero-kicker">{heroCopy.kicker}</span>
          <h2 className="tp-blog-hero-title">{heroCopy.title}</h2>
          <p className="tp-blog-hero-lead">{heroCopy.lead}</p>
        </section>

        <div className="tp-blog-content-wrap">
          {state.posts.length > 0 ? (
            <aside className="tp-blog-tree-sidebar" aria-label={lang === "ar" ? "التاريخ" : "History"}>
              <div className="tp-blog-tree-card">
                <div className="tp-blog-tree-title">{lang === "ar" ? "التاريخ" : "History"}</div>
                {years.map((year) => (
                  <div key={year} className="tp-blog-tree-year">
                    <div className="tp-blog-tree-year-header">{year}</div>
                    {Object.keys(groupedPosts[year])
                      .map(Number)
                      .sort((a, b) => b - a)
                      .map((month) => (
                        <div key={month} className="tp-blog-tree-month">
                          <div className="tp-blog-tree-month-header">{getMonthName(month, lang)}</div>
                          {groupedPosts[year][month].map((post) => (
                            <Link
                              key={post.slug}
                              to={blogPostPath(post.slug)}
                              className={`tp-blog-tree-post-link ${selectedSlug === post.slug ? "active" : ""}`}
                              onMouseEnter={() => setSelectedSlug(post.slug)}
                              onMouseLeave={() => setSelectedSlug(null)}
                              title={post.title}
                            >
                              {truncateText(post.title || post.titleHtml, 40)}
                            </Link>
                          ))}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </aside>
          ) : null}

          <div className="tp-blog-main">
            <div className="tp-blog-list-card">
              <h2 className="tp-blog-list-heading">{t("BLOGS")}</h2>

              {state.loading ? (
                <div className="tp-blog-loading">{lang === "ar" ? "جاري التحميل…" : "Loading…"}</div>
              ) : state.error ? (
                <div className="tp-blog-error">
                  {state.error}
                  <button type="button" className="tp-blog-retry" onClick={() => loadBlogs()}>
                    {t("RETRY_MSG")}
                  </button>
                </div>
              ) : state.posts.length === 0 ? (
                <p className="tp-blog-empty">{t("NO_DATA")}</p>
              ) : (
                <div className="tp-blog-list">
                  {state.posts.map((post) => (
                    <Link
                      key={post.slug}
                      to={blogPostPath(post.slug)}
                      className="tp-blog-item"
                      onMouseEnter={() => setSelectedSlug(post.slug)}
                      onMouseLeave={() => setSelectedSlug(null)}
                    >
                      {post.heroImage ? (
                        <div className="tp-blog-item-thumb">
                          <img src={post.heroImage} alt="" loading="lazy" />
                        </div>
                      ) : null}
                      <div className="tp-blog-item-body">
                        <SafeHtml html={post.titleHtml || post.title} tagName="h3" className="tp-blog-item-title" />
                        <div className="tp-blog-item-meta">
                          {t("PUBLISHED")}: {formatDate(post.published, lang)}
                          {post.author ? ` · ${post.author}` : ""}
                        </div>
                        {post.excerpt ? <p className="tp-blog-item-excerpt">{post.excerpt}</p> : null}
                        <span className="tp-blog-item-cta">
                          {t("READ_MORE")} {lang === "ar" ? "←" : "→"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <SiteFooter t={t} />
      </div>
    </div>
  );
}
