import React, { useCallback, useEffect, useState } from "react";
import { fetchGeneralMarketNews } from "../services/marketNewsService.js";

function formatNewsDate(d, lang) {
  if (!d) return "";
  const locale = lang === "ar" ? "ar-SA" : undefined;
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 604800000) {
    return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

export function HomeMarketNews({ t, lang, dir }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadNews = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchGeneralMarketNews({ page: 0, limit: 20 })
      .then((list) => {
        if (!alive) return;
        setArticles(list);
        setError("");
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e?.message || e));
        setArticles([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadNews();
    return cleanup;
  }, [loadNews, refreshKey]);

  return (
    <section className="tp-home-news tp-card" dir={dir} aria-label={t("HOME_MARKET_NEWS_TITLE")}>
      <div className="tp-news-sidebar-head">
        <h2 className="tp-news-sidebar-title">{t("HOME_MARKET_NEWS_TITLE")}</h2>
        <button
          type="button"
          className="tp-news-refresh"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
        >
          {t("NEWS_REFRESH")}
        </button>
      </div>
      <div className="tp-home-news-body">
        {loading ? (
          <div className="tp-news-status">{t("LOADING")}</div>
        ) : error ? (
          <div className="tp-news-status tp-news-status-error">{t("NEWS_FETCH_ERROR")}</div>
        ) : articles.length === 0 ? (
          <div className="tp-news-status">{t("NEWS_NO_ARTICLES")}</div>
        ) : (
          <ul className="tp-home-news-scroll tp-news-list">
            {articles.map((a, i) => (
              <li key={`${a.url}-${i}`}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tp-home-news-item tp-news-item-link"
                >
                  <span className="tp-news-item-title">{a.title}</span>
                  {(a.date || a.source) && (
                    <div className="tp-news-item-meta">
                      {a.date ? formatNewsDate(a.date, lang) : ""}
                      {a.date && a.source ? " · " : ""}
                      {a.source || ""}
                    </div>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
