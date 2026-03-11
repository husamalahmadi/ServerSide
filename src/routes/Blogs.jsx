// FILE: src/routes/Blogs.jsx
import React, { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n.jsx";
import { getBlogPosts } from "../services/bloggerService.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { PillLink } from "../components/PillLink.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { stripHtmlToText } from "../utils/sanitizeHtml.js";
import { SafeHtml } from "../components/SafeHtml.jsx";

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
  return clean.slice(0, maxLength).trim() + "...";
}

// Group posts by year and month for tree view
function groupPostsByDate(posts) {
  const grouped = {};
  posts.forEach((post) => {
    if (!post.published) return;
    const date = new Date(post.published);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    
    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = [];
    grouped[year][month].push(post);
  });
  
  // Sort months within each year (newest first)
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
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  };
  return months[lang]?.[monthIndex] || months.en[monthIndex] || "";
}

export default function Blogs() {
  const { t, lang, dir } = useI18n();
  usePageMeta({ title: t("BLOGS"), description: t("BLOGS") + " – " + t("PUBLISHED") + "." });
  const [state, setState] = useState({
    loading: true,
    error: "",
    posts: [],
  });
  const [selectedPostId, setSelectedPostId] = useState(null);

  const loadBlogs = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true, error: "" }));
      const posts = await getBlogPosts({ lang, maxResults: 50 });
      const sortedPosts = [...posts].sort((a, b) => {
        const dateA = a.published ? new Date(a.published).getTime() : 0;
        const dateB = b.published ? new Date(b.published).getTime() : 0;
        return dateB - dateA;
      });
      setState({ loading: false, error: "", posts: sortedPosts });
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
  const years = Object.keys(groupedPosts).map(Number).sort((a, b) => b - a); // Newest year first

  return (
    <div dir={dir} lang={lang} style={{ minHeight: "100vh", background: "var(--tp-bg, #f5f2eb)", position: "relative", zIndex: 1 }}>
      <style>{`
        .tp-wrap, .tp-card, .tp-header, .tp-blog-list { box-sizing: border-box; }
        .tp-wrap * { box-sizing: border-box; }
        .tp-container { max-width: 1400px; margin: 0 auto; padding: 16px; }
        .tp-header-wrap { margin-bottom: 16px; }
        .tp-content-wrap { display: flex; gap: 20px; align-items: flex-start; }
        .tp-main-content { flex: 1; min-width: 0; }
        .tp-tree-sidebar {
          width: 280px;
          flex-shrink: 0;
          position: sticky;
          top: 20px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
        }
        [dir="rtl"] .tp-content-wrap {
          flex-direction: row-reverse;
        }
        .tp-card { background: var(--tp-surface, #fff); border: 1px solid var(--tp-border, #ddd8cc); border-radius: 16px; padding: 14px; box-shadow: 0 1px 10px rgba(0,0,0,0.04); }
        .tp-title { font-weight: 900; margin-bottom: 10px; font-family: 'Playfair Display', serif; color: var(--tp-ink, #1a1a14); }
        .tp-muted { color: var(--tp-muted, #8a8578); }
        .tp-danger { color: var(--tp-red, #8b1a1a); }

        .tp-header {
          border-bottom: 2px solid var(--tp-ink, #1a1a14);
          padding: 20px 0 16px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          min-width: 0;
        }
        .tp-brand { min-width: 0; }
        .tp-brand h1 { margin:0; font-size:18px; font-weight:900; }
        .tp-brand p { margin:2px 0 0; font-size:13px; color:#cbd5e1; }

        .tp-actions {
          margin-inline-start: auto;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
          min-width: 0;
        }

        .tp-pill {
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 6px 10px;
          font-weight: 700;
          background: #fff;
          color: #111827;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          white-space: nowrap;
          max-width: 100%;
        }

        .tp-blog-list { margin-top: 16px; }
        .tp-blog-item {
          border: 1px solid var(--tp-border, #ddd8cc);
          border-radius: 14px;
          padding: 16px;
          background: #fff;
          margin-bottom: 16px;
          transition: box-shadow 0.2s;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          display: block;
        }
        .tp-blog-item:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .tp-blog-title {
          font-size: 20px;
          font-weight: 900;
          color: var(--tp-ink, #1a1a14);
          font-family: 'Playfair Display', serif;
          margin-bottom: 8px;
          line-height: 1.3;
        }
        .tp-blog-meta {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 12px;
        }
        .tp-blog-excerpt {
          font-size: 14px;
          color: #334155;
          line-height: 1.6;
          margin-bottom: 12px;
        }
        .tp-blog-link {
          font-size: 14px;
          font-weight: 700;
          color: #2563eb;
          text-decoration: none;
        }
        .tp-blog-link:hover {
          text-decoration: underline;
        }
        
        .tp-tree-card {
          background: var(--tp-surface, #fff);
          border: 1px solid var(--tp-border, #ddd8cc);
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 1px 10px rgba(0,0,0,0.04);
        }
        .tp-tree-title {
          font-weight: 900;
          font-size: 16px;
          margin-bottom: 12px;
          color: var(--tp-ink, #1a1a14);
          font-family: 'Playfair Display', serif;
        }
        .tp-tree-year {
          margin-bottom: 16px;
        }
        .tp-tree-year-header {
          font-weight: 700;
          font-size: 14px;
          color: #1e293b;
          margin-bottom: 8px;
          padding: 4px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .tp-tree-month {
          margin-bottom: 12px;
          padding-inline-start: 12px;
        }
        .tp-tree-month-header {
          font-weight: 600;
          font-size: 13px;
          color: #475569;
          margin-bottom: 6px;
        }
        .tp-tree-post-link {
          display: block;
          font-size: 12px;
          color: #64748b;
          padding: 4px 8px;
          margin-bottom: 4px;
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.2s;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tp-tree-post-link:hover {
          background: #f1f5f9;
          color: #2563eb;
        }
        .tp-tree-post-link.active {
          background: #dbeafe;
          color: #1e40af;
          font-weight: 600;
        }

        @media (max-width: 1024px) {
          .tp-content-wrap { flex-direction: column !important; }
          .tp-tree-sidebar {
            width: 100%;
            position: static;
            max-height: 400px;
          }
        }

        @media (max-width: 520px) {
          .tp-container { padding: 12px; }
          .tp-header { align-items: stretch; }
          .tp-actions { width: 100%; justify-content: space-between; }
          .tp-pill { flex: 1; }
        }
      `}</style>

      <div className="tp-container">
        <PageHeader title="TruePrice.Cash" subtitle={t("BLOGS")}>
          <PillLink to="/" ariaLabel={t("DASHBOARD")}>TruePrice.Cash</PillLink>
          <PillLink to="/about" ariaLabel={t("ABOUT_US")}>{t("ABOUT_US")}</PillLink>
          <PillLink to="/contact" ariaLabel={t("CONTACT_US")}>{t("CONTACT_US")}</PillLink>
        </PageHeader>

        {/* Content Area with Tree View and Blog List */}
        <div className="tp-content-wrap">
          {/* Tree View Sidebar */}
          {state.posts.length > 0 && (
            <div className="tp-tree-sidebar">
              <div className="tp-tree-card">
                <div className="tp-tree-title">{lang === "ar" ? "التاريخ" : "History"}</div>
                {years.map((year) => (
                  <div key={year} className="tp-tree-year">
                    <div className="tp-tree-year-header">{year}</div>
                    {Object.keys(groupedPosts[year])
                      .map(Number)
                      .sort((a, b) => b - a)
                      .map((month) => (
                        <div key={month} className="tp-tree-month">
                          <div className="tp-tree-month-header">{getMonthName(month, lang)}</div>
                          {groupedPosts[year][month].map((post) => (
                            <a
                              key={post.id}
                              href={`#post-${post.id}`}
                              className={`tp-tree-post-link ${selectedPostId === post.id ? "active" : ""}`}
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedPostId(post.id);
                                document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                              title={post.title}
                            >
                              {truncateText(post.title, 40)}
                            </a>
                          ))}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="tp-main-content">
            {/* Blog List */}
            <div className="tp-card tp-blog-list">
              <div className="tp-title">{t("BLOGS")}</div>

          {state.loading ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : state.error ? (
            <div className="tp-danger">
              {state.error}
              <button
                type="button"
                onClick={() => loadBlogs()}
                style={{
                  marginTop: 12,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #b91c1c",
                  background: "#fef2f2",
                  color: "#991b1b",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t("RETRY_MSG")}
              </button>
            </div>
          ) : state.posts.length === 0 ? (
            <div className="tp-muted">
              {t("NO_DATA")}
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <div>Possible reasons:</div>
                <ul style={{ marginTop: 4, paddingInlineStart: 20 }}>
                  <li>No posts with label "{lang === "ar" ? "arabic" : "english"}"</li>
                  <li>Blog has no published posts</li>
                  <li>Check browser console (F12) for API errors</li>
                </ul>
              </div>
            </div>
          ) : (
            <div>
              {state.posts.map((post) => (
                <div key={post.id} id={`post-${post.id}`}>
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tp-blog-item"
                    onMouseEnter={() => setSelectedPostId(post.id)}
                    onMouseLeave={() => setSelectedPostId(null)}
                  >
                    <SafeHtml html={post.title} tagName="div" className="tp-blog-title" />
                    <div className="tp-blog-meta">
                      {t("PUBLISHED")}: {formatDate(post.published, lang)}
                      {post.author ? ` · ${post.author}` : ""}
                    </div>
                    {post.content ? (
                      <div className="tp-blog-excerpt">{truncateText(post.content)}</div>
                    ) : null}
                    <div className="tp-blog-link">{t("READ_MORE")} →</div>
                  </a>
                </div>
              ))}
            </div>
          )}
            </div>
          </div>
        </div>

        <footer
          style={{
            marginTop: 24,
            padding: "14px 4px",
            textAlign: "center",
            color: "var(--tp-muted, #8a8578)",
            fontSize: 12,
          }}
        >
          © TruePrice.Cash
        </footer>
      </div>
    </div>
  );
}
