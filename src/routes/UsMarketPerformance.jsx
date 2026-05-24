import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { StatCard } from "../components/dashboard/StatCard.jsx";
import { Sparkline } from "../components/charts/Sparkline.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { defaultSnapshotDate, fetchUsMarketDashboard } from "../services/usMarketService.js";

function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtPrice(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function pctClass(n) {
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "tp-us-pos" : "tp-us-neg";
}

function SectorBars({ rows, t }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.averageChange - a.averageChange),
    [rows]
  );
  const maxAbs = useMemo(
    () => Math.max(...sorted.map((r) => Math.abs(r.averageChange)), 0.01),
    [sorted]
  );

  if (!sorted.length) {
    return <div className="tp-us-empty">{t("US_MARKET_NO_DATA")}</div>;
  }

  return (
    <ul className="tp-us-sector-list">
      {sorted.map((row) => {
        const w = (Math.abs(row.averageChange) / maxAbs) * 100;
        const positive = row.averageChange >= 0;
        return (
          <li key={row.sector} className="tp-us-sector-row">
            <div className="tp-us-sector-label" title={row.sector}>
              {row.sector}
            </div>
            <div className="tp-us-sector-bar-wrap">
              <div
                className={`tp-us-sector-bar ${positive ? "up" : "down"}`}
                style={{ width: `${Math.max(w, 4)}%` }}
              />
            </div>
            <div className={`tp-us-sector-pct ${pctClass(row.averageChange)}`}>
              {fmtPct(row.averageChange)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function IndustryList({ rows, t }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.averageChange - a.averageChange),
    [rows]
  );
  const top = sorted.slice(0, 8);
  const bottom = [...sorted].reverse().slice(0, 8);

  if (!sorted.length) {
    return <div className="tp-us-empty">{t("US_MARKET_NO_DATA")}</div>;
  }

  return (
    <div className="tp-us-industry-cols">
      <div>
        <h4 className="tp-us-subhead">{t("US_MARKET_INDUSTRY_TOP")}</h4>
        <ul className="tp-us-industry-list">
          {top.map((row) => (
            <li key={`top-${row.industry}`} className="tp-us-industry-item">
              <span className="tp-us-industry-name" title={row.industry}>
                {row.industry}
              </span>
              <span className={`tp-us-industry-pct ${pctClass(row.averageChange)}`}>
                {fmtPct(row.averageChange)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="tp-us-subhead">{t("US_MARKET_INDUSTRY_BOTTOM")}</h4>
        <ul className="tp-us-industry-list">
          {bottom.map((row) => (
            <li key={`bot-${row.industry}`} className="tp-us-industry-item">
              <span className="tp-us-industry-name" title={row.industry}>
                {row.industry}
              </span>
              <span className={`tp-us-industry-pct ${pctClass(row.averageChange)}`}>
                {fmtPct(row.averageChange)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MoversTable({ rows, onOpen, t, emptyLabel }) {
  if (!rows?.length) {
    return <div className="tp-us-empty">{emptyLabel || t("US_MARKET_NO_DATA")}</div>;
  }

  return (
    <div className="tp-us-movers-scroll">
      <table className="tp-us-movers-table">
        <thead>
          <tr>
            <th>{t("TICKER")}</th>
            <th>{t("US_MARKET_COL_NAME")}</th>
            <th className="tp-us-num">{t("PRICE")}</th>
            <th className="tp-us-num">{t("US_MARKET_CHANGE_PCT")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol}>
              <td>
                <button type="button" className="tp-us-ticker-btn" onClick={() => onOpen(row.symbol)}>
                  {row.symbol}
                </button>
              </td>
              <td className="tp-us-name-cell" title={row.name}>
                {row.name}
              </td>
              <td className="tp-us-num">${fmtPrice(row.price)}</td>
              <td className={`tp-us-num ${pctClass(row.changesPercentage)}`}>
                {fmtPct(row.changesPercentage)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UsMarketPerformance() {
  const { t, lang, dir } = useI18n();
  const navigate = useNavigate();
  const [snapshotDate, setSnapshotDate] = useState(defaultSnapshotDate);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pageTitle =
    lang === "ar"
      ? "أداء السوق الأمريكي – TruePrice.Cash"
      : "US Stock Market Performance – TruePrice";
  const pageDesc =
    lang === "ar"
      ? "لقطة أداء قطاعات وصناعات السوق الأمريكي، أكبر الرابحين والخاسرين، وأكثر الأسهم تداولاً على TruePrice.Cash."
      : "US sector and industry performance snapshots, biggest gainers and losers, and most active stocks on TruePrice.Cash.";

  usePageMeta({
    title: pageTitle,
    description: pageDesc,
    canonicalPath: "/us-markets",
  });

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchUsMarketDashboard({ date: snapshotDate })
      .then((json) => {
        if (!alive) return;
        setData(json);
        if (json?.date) setSnapshotDate(json.date);
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
  }, [snapshotDate, reloadNonce]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const sectors = data?.sectors ?? [];
  const industries = data?.industries ?? [];
  const gainers = data?.gainers ?? [];
  const losers = data?.losers ?? [];
  const mostActives = data?.mostActives ?? [];

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

  return (
    <div className="tp-page tp-us-page" dir={dir} lang={lang}>
      <header className="tp-page-header">
        <h1 className="tp-page-title">
          {t("US_MARKET_TITLE")}
        </h1>
        <p className="tp-page-sub">{t("US_MARKET_SUB")}</p>
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
            <label className="tp-us-date-label">
              <span>{t("US_MARKET_SNAPSHOT_DATE")}</span>
              <input
                type="date"
                className="tp-us-date-input"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                disabled={loading}
              />
            </label>
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
                <span className="tp-panel-head-meta">{data.date}</span>
              </div>
              <div className="tp-panel-body">
                <SectorBars rows={sectors} t={t} />
              </div>
            </section>

            <section className="tp-panel tp-span-6">
              <div className="tp-panel-head">
                <h2 className="tp-panel-title">{t("US_MARKET_INDUSTRIES")}</h2>
                <span className="tp-panel-head-meta">{industries.length} {t("US_MARKET_INDUSTRIES_COUNT")}</span>
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
                <MoversTable rows={gainers.slice(0, 15)} onOpen={openTicker} t={t} />
              </div>
            </section>

            <section className="tp-panel tp-span-4">
              <div className="tp-panel-head tp-us-head-losers">
                <h2 className="tp-panel-title">{t("US_MARKET_LOSERS")}</h2>
              </div>
              <div className="tp-panel-body tp-us-movers-body">
                <MoversTable rows={losers.slice(0, 15)} onOpen={openTicker} t={t} />
              </div>
            </section>

            <section className="tp-panel tp-span-4">
              <div className="tp-panel-head tp-us-head-active">
                <h2 className="tp-panel-title">{t("US_MARKET_MOST_ACTIVE")}</h2>
              </div>
              <div className="tp-panel-body tp-us-movers-body">
                <MoversTable rows={mostActives.slice(0, 15)} onOpen={openTicker} t={t} />
              </div>
            </section>
          </div>

          <p className="tp-us-footnote">
            {t("US_MARKET_FOOTNOTE")}{" "}
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
