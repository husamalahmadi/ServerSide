// FILE: src/routes/Home.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { getAllStocks } from "../data/stocksCatalog.js";
import { StatCard } from "../components/dashboard/StatCard.jsx";
import { MiniBarChart } from "../components/charts/MiniBarChart.jsx";
import { Sparkline } from "../components/charts/Sparkline.jsx";
import { DonutChart } from "../components/charts/DonutChart.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { buildHomeSeo } from "../seo/structuredData.js";
import { getScreenerDataset } from "../services/screenerService.js";
import { useScreener } from "../hooks/useScreener.js";
import { mergeScreenerWithCatalog, isUsableScreenerRow } from "../domain/screenerMetrics.js";
import { filterStocksByQuery } from "../domain/stockSearch.js";
import { ScreenerResultsTable } from "../components/screener/ScreenerResultsTable.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";

const QUICK_PICKS = [
  { ticker: "AAPL", name: "Apple", market: "us" },
  { ticker: "MSFT", name: "Microsoft", market: "us" },
  { ticker: "2222", name: "Saudi Aramco", market: "sa" },
  { ticker: "7203.T", name: "Toyota", market: "jp" },
  { ticker: "NVDA", name: "NVIDIA", market: "us" },
  { ticker: "1120", name: "Al Rajhi Bank", market: "sa" },
  { ticker: "6758.T", name: "Sony", market: "jp" },
  { ticker: "AMZN", name: "Amazon", market: "us" },
];

export default function Home() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authParam = searchParams.get("auth");
  // Legacy ?auth=api_required (old client builds). Strip silently — do not show a banner.
  useEffect(() => {
    if (searchParams.get("auth") !== "api_required") return;
    const next = new URLSearchParams(searchParams);
    next.delete("auth");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const qParam = searchParams.get("q");
    if (qParam) {
      setQ(qParam);
      setSuggestionsOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("q");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const homeSeo = useMemo(() => buildHomeSeo(lang), [lang]);
  usePageMeta(homeSeo);

  const [q, setQ] = useState("");
  const [marketFilter, setMarketFilter] = useState("all");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const wrapRef = useRef(null);

  const [state, setState] = useState({
    loading: true,
    error: "",
    items: [],
    industries: [],
  });
  const [screenerState, setScreenerState] = useState({
    loading: true,
    error: "",
    items: [],
    sectors: [],
    rebuilding: false,
  });

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setState((s) => ({ ...s, loading: true, error: "" }));
        const json = await getAllStocks();
        if (!alive) return;
        setState({
          loading: false,
          error: "",
          items: json?.items || [],
          industries: json?.industries || [],
        });
      } catch (e) {
        if (!alive) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: t("ERR_LOAD_STOCKS"),
          items: [],
          industries: [],
        }));
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [t]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setScreenerState({ loading: true, error: "", items: [], sectors: [], rebuilding: false });
        const data = await getScreenerDataset();
        if (!alive) return;
        setScreenerState({
          loading: false,
          error: "",
          items: data?.items || [],
          sectors: data?.sectors || [],
          rebuilding: Boolean(data?.rebuilding),
        });
      } catch (e) {
        if (!alive) return;
        setScreenerState({
          loading: false,
          error: t("SCREENER_LOAD_FAILED"),
          items: [],
          sectors: [],
          rebuilding: false,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const marketCounts = useMemo(() => {
    const counts = { us: 0, sa: 0, jp: 0 };
    for (const it of state.items) {
      if (it.market in counts) counts[it.market] += 1;
    }
    return counts;
  }, [state.items]);

  const screenerFeed = useMemo(
    () => mergeScreenerWithCatalog(screenerState.items, state.items),
    [screenerState.items, state.items]
  );

  const { sortBy, sortDir, onSort, applyPreset, activePreset, filteredCount, items: screenerItems } =
    useScreener(screenerFeed);

  const tokyoMetricsPending = useMemo(() => {
    if (activePreset !== "tokyo") return false;
    const jpRows = screenerFeed.filter((r) => r.market === "jp");
    if (!jpRows.length) return false;
    return !jpRows.some(isUsableScreenerRow);
  }, [activePreset, screenerFeed]);

  const screenerSummary = useMemo(() => {
    const rows = screenerItems || [];
    if (!rows.length) return { avgDiscount: null, topSector: "—" };
    const discounts = rows.map((r) => r.discountPct).filter((n) => Number.isFinite(n));
    const avgDiscount = discounts.length ? discounts.reduce((s, n) => s + n, 0) / discounts.length : null;
    const bySector = new Map();
    rows.forEach((r) => bySector.set(r.sector, (bySector.get(r.sector) || 0) + 1));
    const topSector = [...bySector.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    return { avgDiscount, topSector };
  }, [screenerItems]);

  const searchQuery = q.trim();
  const searchActive = searchQuery.length > 0;

  const suggestions = useMemo(
    () => filterStocksByQuery(state.items, searchQuery, { market: marketFilter, limit: 8 }),
    [state.items, searchQuery, marketFilter]
  );

  const searchTableRows = useMemo(() => {
    if (!searchActive) return [];
    return filterStocksByQuery(screenerFeed, searchQuery, { market: marketFilter, limit: 200 });
  }, [searchActive, searchQuery, marketFilter, screenerFeed]);

  const tableItems = searchActive ? searchTableRows : screenerItems;
  const tableCount = searchActive ? searchTableRows.length : filteredCount;

  const totalStocks = marketCounts.us + marketCounts.sa + marketCounts.jp;
  const marketDonut = useMemo(
    () => [
      { label: t("MARKET_US"), value: marketCounts.us || 0, color: "#2c7be5" },
      { label: t("MARKET_SA"), value: marketCounts.sa || 0, color: "#00d27a" },
      { label: t("MARKET_JP"), value: marketCounts.jp || 0, color: "#f5803e" },
    ],
    [marketCounts, t]
  );
  const catalogBar = useMemo(
    () => [marketCounts.us, marketCounts.sa, marketCounts.jp].map((n) => Math.max(1, Math.round(n / 100))),
    [marketCounts]
  );

  function toggleMarketFilter(market) {
    setMarketFilter((prev) => (prev === market ? "all" : market));
  }

  function bestSearchMatch() {
    const hits = filterStocksByQuery(state.items, searchQuery, { market: marketFilter, limit: 1 });
    return hits[0] || null;
  }

  const handleClickOutside = useCallback((e) => {
    if (wrapRef.current && !wrapRef.current.contains(e.target)) {
      setSuggestionsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [handleClickOutside]);

  function goToStock(ticker) {
    setSuggestionsOpen(false);
    setQ("");
    navigate(`/stock/${encodeURIComponent(ticker)}`);
  }

  function pickSuggestion(it) {
    setQ(String(it.ticker));
    setSuggestionsOpen(false);
    goToStock(it.ticker);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        pickSuggestion(suggestions[0]);
      } else if (searchQuery) {
        const match = bestSearchMatch();
        if (match) goToStock(match.ticker);
      }
    }
  }

  return (
    <div className="tp-page">
      <header className="tp-page-header">
        <h1 className="tp-page-title">
          {t("HOME_SEARCH_HEADLINE")}{" "}
          <em>{t("HOME_SEARCH_HEADLINE_EMP")}</em>
        </h1>
        <p className="tp-page-sub">{t("HOME_PAGE_TAGLINE")}</p>
      </header>

      <div className="tp-stats-grid">
        <StatCard
          label={lang === "ar" ? "إجمالي الأسهم" : "Stock universe"}
          value={totalStocks.toLocaleString()}
          chart={<MiniBarChart values={catalogBar} color="#2c7be5" />}
          foot={`US ${marketCounts.us.toLocaleString()} · TASI ${marketCounts.sa.toLocaleString()} · Tokyo ${marketCounts.jp.toLocaleString()}`}
        />
        <StatCard
          label={t("SCREENER_MATCHES")}
          value={tableCount.toLocaleString()}
          chart={<Sparkline values={[12, 18, 14, 22, tableCount % 30 + 8]} color="#2c7be5" />}
          foot={searchActive ? (lang === "ar" ? "نتائج البحث" : "Search results") : (lang === "ar" ? "من الفلتر النشط" : "Active screener filter")}
        />
        <StatCard
          label={t("SCREENER_AVG_DISCOUNT")}
          value={screenerSummary.avgDiscount == null ? "—" : `${screenerSummary.avgDiscount.toFixed(1)}%`}
          chart={<MiniBarChart values={[4, 9, 6, 11, 8, 14]} color="#00d27a" />}
          foot={lang === "ar" ? "متوسط خصم القيمة العادلة" : "Average fair value discount"}
        />
        <StatCard
          label={t("SCREENER_TOP_SECTOR")}
          value={screenerSummary.topSector}
          chart={<Sparkline values={[3, 5, 4, 8, 7, 10, 9]} color="#f5803e" />}
          foot={lang === "ar" ? "أكثر قطاع في النتائج" : "Most common sector in results"}
        />
      </div>

      {authParam === "not_configured" && (
        <div role="status" className="tp-alert tp-alert-error">
          <strong>Google sign-in is not configured on the server.</strong> In your API host (e.g. Render → your Web
          Service → <strong>Environment</strong>), add <code style={{ fontSize: 12 }}>GOOGLE_CLIENT_ID</code> and{" "}
          <code style={{ fontSize: 12 }}>GOOGLE_CLIENT_SECRET</code> from Google Cloud → Credentials → your{" "}
          <em>OAuth 2.0 Client ID</em> (not the Blogger API key). Save and redeploy. In Google Cloud, set the OAuth{" "}
          <strong>redirect URI</strong> to{" "}
          <code style={{ fontSize: 11 }}>https://YOUR-API-HOST/auth/google/callback</code>.
          <button
            type="button"
            onClick={() => {
              searchParams.delete("auth");
              setSearchParams(searchParams, { replace: true });
            }}
            style={{ marginLeft: 12, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      )}
      {authParam === "failed" && (
        <div role="status" className="tp-alert tp-alert-error">
          Google sign-in did not complete. Try again.
          <button
            type="button"
            onClick={() => {
              searchParams.delete("auth");
              setSearchParams(searchParams, { replace: true });
            }}
            style={{ marginLeft: 12, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="tp-dash-grid">
        <div className="tp-card tp-card-pad tp-span-8 tp-search-section">
          <h2 className="tp-card-title" style={{ margin: "0 0 1rem" }}>
            {lang === "ar" ? "بحث وتحليل الأسهم" : "Search & analyze stocks"}
          </h2>
          <h3 className="tp-markets-heading">{t("HOME_MARKETS_HEADING")}</h3>
          <div className="tp-market-strip">
            <button
              type="button"
              className={`tp-market-pill us${marketFilter === "us" ? " active" : ""}`}
              onClick={() => toggleMarketFilter("us")}
            >
              {t("MARKET_US")}
              <span className="tp-mp-count">{marketCounts.us.toLocaleString()}</span>
            </button>
            <button
              type="button"
              className={`tp-market-pill sa${marketFilter === "sa" ? " active" : ""}`}
              onClick={() => toggleMarketFilter("sa")}
            >
              {t("MARKET_SA")}
              <span className="tp-mp-count">{marketCounts.sa.toLocaleString()}</span>
            </button>
            <button
              type="button"
              className={`tp-market-pill jp${marketFilter === "jp" ? " active" : ""}`}
              onClick={() => toggleMarketFilter("jp")}
            >
              {t("MARKET_JP")}
              <span className="tp-mp-count">{marketCounts.jp.toLocaleString()}</span>
            </button>
          </div>

          <div ref={wrapRef} style={{ position: "relative" }}>
            <div className="tp-search-box">
              <div className="tp-field-wrap">
                <input
                  className="tp-ticker-field"
                  type="text"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("SEARCH_PLACEHOLDER")}
                  maxLength={20}
                  autoComplete="off"
                />
                <div className={`tp-suggestions ${suggestionsOpen && suggestions.length > 0 ? "open" : ""}`}>
                  {suggestions.map((it) => (
                    <div
                      key={`${it.ticker}-${it.market || ""}`}
                      className="tp-sug-item"
                      onClick={() => pickSuggestion(it)}
                    >
                      <span className="tp-sug-ticker">{it.ticker}</span>
                      <span className="tp-sug-name">{it.name} · {it.market === "sa" ? "TASI" : it.market === "jp" ? "TOKYO" : "US"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="tp-go-btn"
                onClick={() => {
                  if (suggestions.length > 0) pickSuggestion(suggestions[0]);
                  else if (searchQuery) {
                    const match = bestSearchMatch();
                    if (match) goToStock(match.ticker);
                  }
                }}
              >
                {lang === "ar" ? "تحليل ←" : "Analyze →"}
              </button>
            </div>
          </div>

          <div className="tp-quick-picks">
            <span className="tp-qp-label">{lang === "ar" ? "جرب:" : "Try:"}</span>
            {QUICK_PICKS.map((p) => (
              <Link
                key={p.ticker}
                to={`/stock/${encodeURIComponent(p.ticker)}`}
                className="tp-qp-chip"
                onClick={() => setSuggestionsOpen(false)}
              >
                {p.ticker}
              </Link>
            ))}
          </div>
        </div>

        <div className="tp-card tp-card-pad tp-span-4">
          <h2 className="tp-card-title" style={{ margin: "0 0 0.5rem" }}>
            {lang === "ar" ? "حصة الأسواق" : "Market share"}
          </h2>
          <DonutChart
            segments={marketDonut}
            centerLabel={lang === "ar" ? "الإجمالي" : "Total"}
            centerValue={totalStocks.toLocaleString()}
          />
        </div>
      </div>

      <div className="tp-dash-grid" style={{ marginBottom: "1.25rem" }}>
        <div
          className="tp-cta-card tp-span-4"
          style={{
            background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
            borderColor: "#bfdbfe",
          }}
        >
          <h3 style={{ color: "#1d4ed8" }}>{t("SCREENER_PRESET_US")}</h3>
          <p style={{ color: "#3b6fc9" }}>
            {lang === "ar"
              ? "فلتر سريع لأسهم السوق الأمريكي حسب القيمة العادلة."
              : "Quick screen for US-listed stocks by fair value discount."}
          </p>
          <button type="button" className="tp-btn-primary" onClick={() => applyPreset("us")}>
            {lang === "ar" ? "تشغيل الفلتر" : "Run screener"}
          </button>
        </div>
        <div className="tp-cta-card tp-span-4">
          <h3>{t("SCREENER_PRESET_TASI")}</h3>
          <p>
            {lang === "ar"
              ? "فلتر سريع لأسهم السوق السعودي (تداول) حسب القيمة العادلة."
              : "Quick screen for Saudi (TASI) stocks by fair value discount."}
          </p>
          <button type="button" className="tp-btn-primary" onClick={() => applyPreset("tasi")}>
            {lang === "ar" ? "تشغيل الفلتر" : "Run screener"}
          </button>
        </div>
        <div
          className="tp-cta-card tp-span-4"
          style={{
            background: "linear-gradient(135deg, #e6f0ff 0%, #d6e8ff 100%)",
            borderColor: "#b8d4f5",
          }}
        >
          <h3 style={{ color: "#1a68d1" }}>{t("SCREENER_PRESET_TOKYO")}</h3>
          <p style={{ color: "#3d6db5" }}>
            {lang === "ar"
              ? "استكشف أسهم بورصة طوكيو مع فلاتر القيمة العادلة."
              : "Explore Tokyo Exchange tickers with fair value filters."}
          </p>
          <button
            type="button"
            className="tp-btn-primary"
            onClick={() => applyPreset("tokyo")}
            style={{ background: "#1a68d1" }}
          >
            {lang === "ar" ? "تشغيل الفلتر" : "Run screener"}
          </button>
        </div>
      </div>

      <div id="screener" className="tp-card tp-card-pad tp-screener-section">
        <div className="tp-scr-head">
          <h2 className="tp-title" style={{ margin: 0 }}>{t("SCREENER_TITLE")}</h2>
          <h3 className="tp-scr-count">{t("SCREENER_MATCHES")}: {tableCount}</h3>
        </div>
        <div className="tp-scr-presets">
          <button type="button" className="tp-scr-preset" onClick={() => applyPreset("undervalued")}>
            {t("SCREENER_PRESET_UNDERVALUE")}
          </button>
          <button type="button" className="tp-scr-preset" onClick={() => applyPreset("largecap")}>
            {t("SCREENER_PRESET_LARGECAP")}
          </button>
          <button type="button" className="tp-scr-preset" onClick={() => applyPreset("tasi")}>
            {t("SCREENER_PRESET_TASI")}
          </button>
          <button type="button" className="tp-scr-preset" onClick={() => applyPreset("us")}>
            {t("SCREENER_PRESET_US")}
          </button>
          <button type="button" className="tp-scr-preset" onClick={() => applyPreset("tokyo")}>
            {t("SCREENER_PRESET_TOKYO")}
          </button>
          <button type="button" className="tp-scr-preset" onClick={() => applyPreset("reset")}>
            {t("RESET")}
          </button>
        </div>
        <div className="tp-scr-summary">
          <span>{t("SCREENER_MATCHES")}: <b>{tableCount}</b></span>
          <span>{t("SCREENER_AVG_DISCOUNT")}: <b>{screenerSummary.avgDiscount == null ? "—" : `${screenerSummary.avgDiscount.toFixed(1)}%`}</b></span>
          <span>{t("SCREENER_TOP_SECTOR")}: <b>{screenerSummary.topSector}</b></span>
        </div>
        {screenerState.loading ? (
          <div className="tp-scr-empty">{t("LOADING")}</div>
        ) : screenerState.error ? (
          <div className="tp-scr-empty">{screenerState.error}</div>
        ) : (
          <div className="tp-scr-layout">
            {screenerState.rebuilding ? (
              <div className="tp-scr-tokyo-hint">{t("SCREENER_BUILDING")}</div>
            ) : null}
            {!searchActive ? (
              <div className="tp-scr-hint">
                {lang === "ar" ? "اضغط أحد الأزرار بالأعلى لتشغيل الفرز. إعادة التعيين تعرض نتائج فارغة." : "Press one of the buttons above to run screening. Reset shows no results."}
              </div>
            ) : null}
            {tokyoMetricsPending ? (
              <div className="tp-scr-tokyo-hint">{t("SCREENER_TOKYO_METRICS_PENDING")}</div>
            ) : null}
            {tableItems.length === 0 ? (
              <div className="tp-scr-empty">{t("NO_MATCH")}</div>
            ) : (
              <ScreenerResultsTable
                t={t}
                items={tableItems}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
                onOpenTicker={goToStock}
              />
            )}
          </div>
        )}
      </div>

      <SiteFooter t={t} />
    </div>
  );

}
