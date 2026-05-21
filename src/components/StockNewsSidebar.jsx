import React, { useEffect, useState } from "react";
import { fetchStockNews } from "../services/googleNewsRss.js";

export function StockNewsSidebar({ ticker, companyName = "", market = "us", t, dir, isMobile = false }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadNews = React.useCallback(() => {
    if (!ticker) {
      setArticles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setArticles([]);

    let alive = true;
    fetchStockNews({ ticker, companyName, market })
      .then((list) => {
        if (alive) {
          setArticles(list);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) {
          setError(String(e?.message || e));
          setArticles([]);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [ticker, companyName, market]);

  useEffect(() => {
    loadNews();
  }, [loadNews, refreshKey]);

  const formatDate = (d) => {
    if (!d) return "";
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <aside
      className={`tp-news-sidebar no-print${isMobile ? " tp-news-mobile" : ""}`}
      dir={dir}
      aria-label={t("NEWS_SIDEBAR_TITLE")}
    >
      <div className="tp-news-sidebar-head">
        <h2 className="tp-news-sidebar-title">{t("NEWS_SIDEBAR_TITLE")}</h2>
        <button
          type="button"
          className="tp-news-refresh"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
        >
          {t("NEWS_REFRESH")}
        </button>
      </div>
      <div className="tp-news-sidebar-body">
        {loading ? (
          <div className="tp-news-status">{t("LOADING")}</div>
        ) : error ? (
          <div className="tp-news-status tp-news-status-error">{t("NEWS_FETCH_ERROR")}</div>
        ) : articles.length === 0 ? (
          <div className="tp-news-status">{t("NEWS_NO_ARTICLES")}</div>
        ) : (
          <ul className="tp-news-list">
            {articles.map((a, i) => (
              <li key={`${a.link || a.title}-${i}`}>
                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tp-news-item-link"
                >
                  <span className="tp-news-item-title">{a.title}</span>
                  {(a.date || a.source) && (
                    <div className="tp-news-item-meta">
                      {a.date ? formatDate(a.date) : ""}
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
    </aside>
  );
}
