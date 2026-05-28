// FILE: src/routes/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
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
import { StockSearchBox } from "../components/StockSearchBox.jsx";
import { ScreenerResultsTable } from "../components/screener/ScreenerResultsTable.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { HomeMarketNews } from "../components/HomeMarketNews.jsx";
import { HomeSignalsPanel } from "../components/home/HomeSignalsPanel.jsx";

export default function Home() {
  const { t, lang, dir } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authParam = searchParams.get("auth");
  const [q, setQ] = useState("");
  const [marketFilter, setMarketFilter] = useState("all");

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
      const next = new URLSearchParams(searchParams);
      next.delete("q");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const homeSeo = useMemo(() => buildHomeSeo(lang), [lang]);
  usePageMeta(homeSeo);

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

  function goToStock(ticker) {
    setQ("");
    navigate(`/stock/${encodeURIComponent(ticker)}`);
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
          <StockSearchBox
            variant="section"
            catalogItems={state.items}
            catalogLoading={state.loading}
            catalogError={state.error}
            query={q}
            onQueryChange={setQ}
            marketFilter={marketFilter}
            onMarketFilterChange={setMarketFilter}
          />
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

      <HomeSignalsPanel t={t} lang={lang} dir={dir} />

      <HomeMarketNews t={t} lang={lang} dir={dir} />

      <section id="screener" className="tp-panel tp-screener-section" dir={dir} aria-label={t("SCREENER_TITLE")}>
        <div className="tp-panel-head">
          <h2 className="tp-panel-title">{t("SCREENER_TITLE")}</h2>
          <p className="tp-panel-head-meta">
            {t("SCREENER_MATCHES")}: <b>{tableCount}</b>
          </p>
        </div>
        <div className="tp-panel-body">
          <div className="tp-scr-toolbar">
            <aside className="tp-scr-market-rail" aria-label={t("SCREENER_MARKET_FOCUS_RAIL")}>
              <div className="tp-scr-rail-label">{t("SCREENER_RAIL_LABEL")}</div>
              <button
                type="button"
                className={`tp-scr-focus-card tp-scr-focus-us${activePreset === "us" ? " is-active" : ""}`}
                onClick={() => applyPreset("us")}
                aria-pressed={activePreset === "us"}
              >
                <span className="tp-scr-focus-badge" aria-hidden>
                  US
                </span>
                <span className="tp-scr-focus-title">{t("SCREENER_PRESET_US")}</span>
                <span className="tp-scr-focus-sub">{t("SCREENER_RAIL_US_HINT")}</span>
                <span className="tp-scr-focus-go">{t("SCREENER_RAIL_RUN")}</span>
              </button>
              <button
                type="button"
                className={`tp-scr-focus-card tp-scr-focus-sa${activePreset === "tasi" ? " is-active" : ""}`}
                onClick={() => applyPreset("tasi")}
                aria-pressed={activePreset === "tasi"}
              >
                <span className="tp-scr-focus-badge tp-scr-focus-badge-sa" aria-hidden>
                  SA
                </span>
                <span className="tp-scr-focus-title">{t("SCREENER_PRESET_TASI")}</span>
                <span className="tp-scr-focus-sub">{t("SCREENER_RAIL_SA_HINT")}</span>
                <span className="tp-scr-focus-go">{t("SCREENER_RAIL_RUN")}</span>
              </button>
              <button
                type="button"
                className={`tp-scr-focus-card tp-scr-focus-jp${activePreset === "tokyo" ? " is-active" : ""}`}
                onClick={() => applyPreset("tokyo")}
                aria-pressed={activePreset === "tokyo"}
              >
                <span className="tp-scr-focus-badge tp-scr-focus-badge-jp" aria-hidden>
                  JP
                </span>
                <span className="tp-scr-focus-title">{t("SCREENER_PRESET_TOKYO")}</span>
                <span className="tp-scr-focus-sub">{t("SCREENER_RAIL_JP_HINT")}</span>
                <span className="tp-scr-focus-go">{t("SCREENER_RAIL_RUN")}</span>
              </button>
            </aside>
            <div className="tp-scr-main-col">
              <div className="tp-scr-presets">
                <button type="button" className="tp-scr-preset" onClick={() => applyPreset("undervalued")}>
                  {t("SCREENER_PRESET_UNDERVALUE")}
                </button>
                <button type="button" className="tp-scr-preset" onClick={() => applyPreset("largecap")}>
                  {t("SCREENER_PRESET_LARGECAP")}
                </button>
                <button type="button" className="tp-scr-preset" onClick={() => applyPreset("reset")}>
                  {t("RESET")}
                </button>
              </div>
              <div className="tp-scr-summary">
                <span>
                  {t("SCREENER_MATCHES")}: <b>{tableCount}</b>
                </span>
                <span>
                  {t("SCREENER_AVG_DISCOUNT")}:{" "}
                  <b>{screenerSummary.avgDiscount == null ? "—" : `${screenerSummary.avgDiscount.toFixed(1)}%`}</b>
                </span>
                <span>
                  {t("SCREENER_TOP_SECTOR")}: <b>{screenerSummary.topSector}</b>
                </span>
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
                  {!searchActive ? <div className="tp-scr-hint">{t("SCREENER_HINT_IDLE")}</div> : null}
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
          </div>
        </div>
      </section>

      <SiteFooter t={t} />
    </div>
  );

}
