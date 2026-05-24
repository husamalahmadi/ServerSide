import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { StatCard } from "../components/dashboard/StatCard.jsx";
import { Sparkline } from "../components/charts/Sparkline.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import {
  SectorBars,
  IndustryList,
  MoversTable,
  fmtPct,
  fmtPrice,
} from "../components/market/MarketPerformancePanels.jsx";
import { fetchRegionalMarketDashboard } from "../services/regionalMarketService.js";

const CONFIG = {
  sa: {
    market: "sa",
    canonicalPath: "/sa-markets",
    currency: "SAR",
    titleKey: "SA_MARKET_TITLE",
    subKey: "SA_MARKET_SUB",
    navFootKey: "SA_MARKET_FOOTNOTE",
    pageTitleEn: "TASI Stock Market Performance – TruePrice",
    pageTitleAr: "أداء سوق تداول (تاسي) – TruePrice.Cash",
    pageDescEn:
      "TASI sector performance, top gainers, losers, and most active Saudi stocks on TruePrice.Cash.",
    pageDescAr:
      "أداء قطاعات تداول، أكبر الرابحين والخاسرين، وأكثر الأسهم السعودية تداولاً على TruePrice.Cash.",
    formatPrice: (n) => `${fmtPrice(n)} SAR`,
  },
  jp: {
    market: "jp",
    canonicalPath: "/jp-markets",
    currency: "JPY",
    titleKey: "JP_MARKET_TITLE",
    subKey: "JP_MARKET_SUB",
    navFootKey: "JP_MARKET_FOOTNOTE",
    pageTitleEn: "Tokyo Stock Exchange Performance – TruePrice",
    pageTitleAr: "أداء بورصة طوكيو – TruePrice.Cash",
    pageDescEn:
      "Tokyo market movers, volume leaders, and grouped performance on TruePrice.Cash.",
    pageDescAr:
      "أكبر الرابحين والخاسرين في طوكيو، الأكثر تداولاً، وملخص الأداء على TruePrice.Cash.",
    formatPrice: (n) => `¥${fmtPrice(n)}`,
  },
};

export default function RegionalMarketPerformance({ marketId }) {
  const cfg = CONFIG[marketId];
  const { t, lang, dir } = useI18n();
  const navigate = useNavigate();
  const [reloadNonce, setReloadNonce] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  usePageMeta({
    title: lang === "ar" ? cfg.pageTitleAr : cfg.pageTitleEn,
    description: lang === "ar" ? cfg.pageDescAr : cfg.pageDescEn,
    canonicalPath: cfg.canonicalPath,
  });

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchRegionalMarketDashboard(cfg.market)
      .then((json) => {
        if (!alive) return;
        setData(json);
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e?.message || e));
        setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [cfg.market, reloadNonce]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const sectors = data?.sectors ?? [];
  const industries = data?.industries ?? [];
  const gainers = data?.gainers ?? [];
  const losers = data?.losers ?? [];
  const mostActives = data?.mostActives ?? [];

  const asOfLabel = useMemo(() => {
    if (!data?.asOf) return "";
    try {
      return new Date(data.asOf).toLocaleString(lang === "ar" ? "ar-SA" : undefined);
    } catch {
      return data.asOf;
    }
  }, [data?.asOf, lang]);

  const kpis = useMemo(() => {
    if (!sectors.length) {
      return { bestSector: "—", worstSector: "—", sectorsUp: 0, topGainer: "—", topGainerPct: null };
    }
    const sorted = [...sectors].sort((a, b) => b.averageChange - a.averageChange);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const sectorsUp = sectors.filter((s) => s.averageChange > 0).length;
    const top = gainers[0];
    return {
      bestSector: best?.sector ?? "—",
      worstSector: worst?.sector ?? "—",
      sectorsUp,
      topGainer: top?.symbol ?? "—",
      topGainerPct: top?.changesPercentage ?? null,
    };
  }, [sectors, gainers]);

  const sectorSpark = useMemo(
    () => [...sectors].sort((a, b) => a.sector.localeCompare(b.sector)).map((s) => Math.max(0, s.averageChange + 3)),
    [sectors]
  );

  const openTicker = (symbol) => {
    if (!symbol) return;
    navigate(`/stock/${encodeURIComponent(symbol)}`);
  };

  const coverageNote =
    data?.catalogCount && data?.quoteCount
      ? t("REGIONAL_MARKET_COVERAGE")
          .replace("{quoted}", String(data.quoteCount))
          .replace("{catalog}", String(data.catalogCount))
      : "";

  return (
    <div className="tp-page tp-us-page" dir={dir} lang={lang}>
      <header className="tp-page-header">
        <h1 className="tp-page-title">{t(cfg.titleKey)}</h1>
        <p className="tp-page-sub">{t(cfg.subKey)}</p>
      </header>

      <div className="tp-stats-grid">
        <StatCard
          label={t("US_MARKET_BEST_SECTOR")}
          value={kpis.bestSector}
          chart={<Sparkline values={sectorSpark.length ? sectorSpark : [3, 5, 4, 7]} color="#00d27a" />}
          foot={sectors.length ? fmtPct(sectors.find((s) => s.sector === kpis.bestSector)?.averageChange) : ""}
        />
        <StatCard
          label={t("US_MARKET_WORST_SECTOR")}
          value={kpis.worstSector}
          chart={<Sparkline values={[8, 6, 5, 4, 3, 2]} color="#e63757" />}
          foot={sectors.length ? fmtPct(sectors.find((s) => s.sector === kpis.worstSector)?.averageChange) : ""}
        />
        <StatCard
          label={t("US_MARKET_SECTORS_UP")}
          value={`${kpis.sectorsUp} / ${sectors.length || "—"}`}
          chart={<Sparkline values={[4, 6, 5, 8, 7, kpis.sectorsUp || 5]} color="#2c7be5" />}
          foot={t("US_MARKET_SECTORS_UP_HINT")}
        />
        <StatCard
          label={t("US_MARKET_TOP_GAINER")}
          value={kpis.topGainer}
          chart={<Sparkline values={[2, 4, 6, 9, 12, 15]} color="#f5803e" />}
          foot={kpis.topGainerPct == null ? "" : fmtPct(kpis.topGainerPct)}
        />
      </div>

      <section className="tp-panel tp-us-toolbar-panel">
        <div className="tp-panel-head">
          <h2 className="tp-panel-title">{t("US_MARKET_DATA_CONTROLS")}</h2>
          <div className="tp-us-toolbar-actions">
            {asOfLabel ? (
              <span className="tp-panel-head-meta">
                {t("REGIONAL_MARKET_AS_OF")} {asOfLabel}
              </span>
            ) : null}
            <button
              type="button"
              className="tp-news-refresh"
              onClick={() => setReloadNonce((n) => n + 1)}
              disabled={loading}
            >
              {loading ? t("LOADING") : t("NEWS_REFRESH")}
            </button>
          </div>
        </div>
        {coverageNote ? (
          <div className="tp-panel-body tp-us-coverage-note">{coverageNote}</div>
        ) : null}
        {error ? (
          <div className="tp-panel-body">
            <div className="tp-news-status tp-news-status-error">{error}</div>
          </div>
        ) : null}
      </section>

      {loading && !data ? (
        <div className="tp-us-loading">{t("LOADING")}</div>
      ) : data ? (
        <>
          <div className="tp-dash-grid tp-us-grid-2">
            <section className="tp-panel tp-span-6">
              <div className="tp-panel-head">
                <h2 className="tp-panel-title">{t("US_MARKET_SECTORS")}</h2>
                <span className="tp-panel-head-meta">{cfg.currency}</span>
              </div>
              <div className="tp-panel-body">
                <SectorBars rows={sectors} t={t} />
              </div>
            </section>

            <section className="tp-panel tp-span-6">
              <div className="tp-panel-head">
                <h2 className="tp-panel-title">{t("US_MARKET_INDUSTRIES")}</h2>
                <span className="tp-panel-head-meta">
                  {industries.length} {t("US_MARKET_INDUSTRIES_COUNT")}
                </span>
              </div>
              <div className="tp-panel-body tp-us-industry-body">
                <IndustryList rows={industries} t={t} />
              </div>
            </section>
          </div>

          <div className="tp-dash-grid tp-us-movers-grid">
            <section className="tp-panel tp-span-4">
              <div className="tp-panel-head tp-us-head-gainers">
                <h2 className="tp-panel-title">{t("US_MARKET_GAINERS")}</h2>
              </div>
              <div className="tp-panel-body tp-us-movers-body">
                <MoversTable
                  rows={gainers.slice(0, 15)}
                  onOpen={openTicker}
                  t={t}
                  formatPriceCell={cfg.formatPrice}
                />
              </div>
            </section>

            <section className="tp-panel tp-span-4">
              <div className="tp-panel-head tp-us-head-losers">
                <h2 className="tp-panel-title">{t("US_MARKET_LOSERS")}</h2>
              </div>
              <div className="tp-panel-body tp-us-movers-body">
                <MoversTable
                  rows={losers.slice(0, 15)}
                  onOpen={openTicker}
                  t={t}
                  formatPriceCell={cfg.formatPrice}
                />
              </div>
            </section>

            <section className="tp-panel tp-span-4">
              <div className="tp-panel-head tp-us-head-active">
                <h2 className="tp-panel-title">{t("US_MARKET_MOST_ACTIVE")}</h2>
              </div>
              <div className="tp-panel-body tp-us-movers-body">
                <MoversTable
                  rows={mostActives.slice(0, 15)}
                  onOpen={openTicker}
                  t={t}
                  formatPriceCell={cfg.formatPrice}
                />
              </div>
            </section>
          </div>

          <p className="tp-us-footnote">
            {t(cfg.navFootKey)}{" "}
            <Link to="/#screener">{t("US_MARKET_SCREENER_LINK")}</Link>
            {" · "}
            <Link to="/">{t("FOOTER_HOME")}</Link>
          </p>
        </>
      ) : null}

      <SiteFooter t={t} />
    </div>
  );
}

export function SaMarketPerformance() {
  return <RegionalMarketPerformance marketId="sa" />;
}

export function JpMarketPerformance() {
  return <RegionalMarketPerformance marketId="jp" />;
}
