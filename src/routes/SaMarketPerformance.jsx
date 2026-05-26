import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { SaMoversTable } from "../components/market/SaMoversTable.jsx";
import { fmtPrice } from "../components/market/SaMoversTable.jsx";
import { fetchSaMarketDashboard } from "../services/saMarketService.js";
import { fetchSaMarketUniverse } from "../services/marketUniverseService.js";
import { MarketUniversePanel } from "../components/market/MarketUniversePanel.jsx";

const formatPrice = (n) => `${fmtPrice(n)} SAR`;

export default function SaMarketPerformance() {
  const { t, lang, dir } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [universe, setUniverse] = useState(null);
  const [universeLoading, setUniverseLoading] = useState(true);
  const [universeError, setUniverseError] = useState("");
  const [universeNonce, setUniverseNonce] = useState(0);

  usePageMeta({
    title:
      lang === "ar"
        ? "أداء سوق تداول (تاسي) – TruePrice.Cash"
        : "TASI Stock Market Performance – TruePrice",
    description:
      lang === "ar"
        ? "أكبر الرابحين والخاسرين والأكثر تداولاً في سوق تداول على TruePrice.Cash."
        : "TASI top gainers, losers, and most traded stocks on TruePrice.Cash.",
    canonicalPath: "/sa-markets",
  });

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchSaMarketDashboard()
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
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const loadUniverse = useCallback(() => {
    let alive = true;
    setUniverseLoading(true);
    setUniverseError("");
    fetchSaMarketUniverse()
      .then((json) => {
        if (!alive) return;
        setUniverse(json);
      })
      .catch((e) => {
        if (!alive) return;
        setUniverseError(String(e?.message || e));
        setUniverse(null);
      })
      .finally(() => {
        if (alive) setUniverseLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [universeNonce]);

  useEffect(() => {
    const cleanup = loadUniverse();
    return cleanup;
  }, [loadUniverse]);

  const gainers = data?.gainers ?? [];
  const losers = data?.losers ?? [];
  const mostActives = data?.mostActives ?? [];

  const openTicker = (symbol) => {
    if (!symbol) return;
    navigate(`/stock/${encodeURIComponent(symbol)}`);
  };

  return (
    <div className="tp-page tp-us-page" dir={dir} lang={lang}>
      <header className="tp-page-header">
        <h1 className="tp-page-title">{t("SA_MARKET_TITLE")}</h1>
        <p className="tp-page-sub">{t("SA_MARKET_SUB")}</p>
      </header>

      {error ? (
        <div className="tp-news-status tp-news-status-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="tp-us-loading">{t("LOADING")}</div>
      ) : data ? (
        <>
          <div className="tp-dash-grid tp-us-movers-grid">
            <section className="tp-panel tp-span-4">
              <div className="tp-panel-head tp-us-head-gainers">
                <h2 className="tp-panel-title">{t("US_MARKET_GAINERS")}</h2>
              </div>
              <div className="tp-panel-body tp-us-movers-body">
                <SaMoversTable rows={gainers.slice(0, 15)} onOpen={openTicker} t={t} formatPriceCell={formatPrice} />
              </div>
            </section>

            <section className="tp-panel tp-span-4">
              <div className="tp-panel-head tp-us-head-losers">
                <h2 className="tp-panel-title">{t("US_MARKET_LOSERS")}</h2>
              </div>
              <div className="tp-panel-body tp-us-movers-body">
                <SaMoversTable rows={losers.slice(0, 15)} onOpen={openTicker} t={t} formatPriceCell={formatPrice} />
              </div>
            </section>

            <section className="tp-panel tp-span-4">
              <div className="tp-panel-head tp-us-head-active">
                <h2 className="tp-panel-title">{t("US_MARKET_MOST_ACTIVE")}</h2>
              </div>
              <div className="tp-panel-body tp-us-movers-body">
                <SaMoversTable
                  rows={mostActives.slice(0, 15)}
                  onOpen={openTicker}
                  t={t}
                  formatPriceCell={formatPrice}
                />
              </div>
            </section>
          </div>

          <p className="tp-us-footnote">
            {t("SA_MARKET_FOOTNOTE")}{" "}
            <Link to="/#screener">{t("US_MARKET_SCREENER_LINK")}</Link>
            {" · "}
            <Link to="/">{t("FOOTER_HOME")}</Link>
          </p>
        </>
      ) : null}

      <MarketUniversePanel
        data={universe}
        loading={universeLoading}
        error={universeError}
        market="sa"
        t={t}
        lang={lang}
        onOpen={openTicker}
        onRefresh={() => setUniverseNonce((n) => n + 1)}
      />

      <SiteFooter t={t} />
    </div>
  );
}
