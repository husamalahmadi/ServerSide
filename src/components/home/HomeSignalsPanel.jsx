import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHomeSignals } from "../../services/homeSignalsService.js";

function fmtPrice(n, market) {
  if (!Number.isFinite(n)) return "—";
  if (market === "sa") return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} SAR`;
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function pctClass(n) {
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "tp-us-pos" : "tp-us-neg";
}

function formatUpdated(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(lang === "ar" ? "ar-SA" : undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SignalCard({ title, tag, tagClass, rows, market, t, emptyLabel, renderMeta }) {
  return (
    <article className="tp-signal-card">
      <header className="tp-signal-card-head">
        <h3 className="tp-signal-card-title">{title}</h3>
        <span className={`tp-signal-tag ${tagClass || ""}`}>{tag}</span>
      </header>
      {!rows?.length ? (
        <p className="tp-signal-empty">{emptyLabel}</p>
      ) : (
        <ul className="tp-signal-list">
          {rows.map((row) => (
            <li key={`${market}-${row.symbol}`}>
              <Link
                to={`/stock/${encodeURIComponent(row.symbol)}`}
                className="tp-signal-row"
              >
                <span className="tp-signal-ticker">{row.symbol}</span>
                <span className="tp-signal-name" title={row.name}>
                  {row.name}
                </span>
                <span className="tp-signal-metric">
                  {renderMeta ? renderMeta(row) : fmtPrice(row.price, market)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function HomeSignalsPanel({ t, lang, dir }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marketTab, setMarketTab] = useState("us");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchHomeSignals()
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
  }, [refreshKey]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const block = marketTab === "sa" ? data?.sa : data?.us;

  return (
    <section className="tp-signals-panel tp-panel tp-span-12" dir={dir} aria-label={t("HOME_SIGNALS_TITLE")}>
      <div className="tp-panel-head tp-signals-head">
        <div>
          <h2 className="tp-panel-title">{t("HOME_SIGNALS_TITLE")}</h2>
          <p className="tp-signals-sub">{t("HOME_SIGNALS_SUB")}</p>
        </div>
        <div className="tp-signals-head-actions">
          <div className="tp-signals-market-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={marketTab === "us"}
              className={marketTab === "us" ? "active" : ""}
              onClick={() => setMarketTab("us")}
            >
              {t("MARKET_US")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={marketTab === "sa"}
              className={marketTab === "sa" ? "active sa" : ""}
              onClick={() => setMarketTab("sa")}
            >
              {t("MARKET_SA")}
            </button>
          </div>
          <button
            type="button"
            className="tp-news-refresh"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            {loading ? t("LOADING") : t("NEWS_REFRESH")}
          </button>
        </div>
      </div>

      {data?.updatedAt ? (
        <div className="tp-signals-meta">
          {t("HOME_SIGNALS_UPDATED")} {formatUpdated(data.updatedAt, lang)}
          <span className="tp-signals-meta-sep">·</span>
          {t("HOME_SIGNALS_CACHE")} {data.cacheMinutes ?? 12} {t("MARKET_UNIVERSE_MIN")}
        </div>
      ) : null}

      <div className="tp-panel-body tp-signals-body">
        {loading && !data ? (
          <div className="tp-signals-grid tp-signals-skeleton">
            {[1, 2, 3].map((i) => (
              <div key={i} className="tp-signal-card tp-signal-skel" />
            ))}
          </div>
        ) : error ? (
          <div className="tp-news-status tp-news-status-error">{error}</div>
        ) : (
          <div className="tp-signals-grid">
            <SignalCard
              title={t("HOME_SIGNALS_GAINERS")}
              tag={t("HOME_SIGNALS_TAG_LIVE")}
              tagClass="tp-signal-tag-live"
              rows={block?.gainers}
              market={marketTab}
              t={t}
              emptyLabel={t("HOME_SIGNALS_EMPTY")}
              renderMeta={(row) => (
                <span className={pctClass(row.changesPercentage)}>{fmtPct(row.changesPercentage)}</span>
              )}
            />
            <SignalCard
              title={t("HOME_SIGNALS_UNUSUAL")}
              tag={t("HOME_SIGNALS_TAG_VOLUME")}
              tagClass="tp-signal-tag-volume"
              rows={block?.unusualVolume}
              market={marketTab}
              t={t}
              emptyLabel={t("HOME_SIGNALS_EMPTY")}
              renderMeta={(row) => (
                <span className="tp-signal-vol-ratio">
                  {row.volumeRatio != null ? `${row.volumeRatio}×` : "—"}
                </span>
              )}
            />
            <SignalCard
              title={t("HOME_SIGNALS_NEAR_FAIR")}
              tag={t("HOME_SIGNALS_TAG_VALUE")}
              tagClass="tp-signal-tag-value"
              rows={(block?.nearFair || []).map((r) => ({
                symbol: r.ticker,
                name: r.name,
                discountPct: r.discountPct,
                price: r.priceApprox,
              }))}
              market={marketTab}
              t={t}
              emptyLabel={t("HOME_SIGNALS_NEAR_FAIR_EMPTY")}
              renderMeta={(row) => (
                <span className={pctClass(row.discountPct)}>
                  {row.discountPct == null ? "—" : `${fmtPct(row.discountPct)} FV`}
                </span>
              )}
            />
          </div>
        )}
      </div>
    </section>
  );
}
