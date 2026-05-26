import React, { useMemo, useState } from "react";

function fmtPrice(n, currency = "USD") {
  if (!Number.isFinite(n)) return "—";
  if (currency === "SAR") {
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return n.toFixed(2);
  }
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
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

function industryHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
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

export function MarketUniversePanel({
  data,
  loading,
  error,
  market = "us",
  t,
  lang,
  onOpen,
  onRefresh,
}) {
  const [query, setQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [view, setView] = useState("table");
  const [sort, setSort] = useState({ key: "symbol", dir: 1 });

  const currency = market === "sa" ? "SAR" : "USD";
  const pricePrefix = market === "sa" ? "" : "$";

  const industries = data?.industries ?? [];
  const stocks = data?.stocks ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stocks.filter((s) => {
      if (industryFilter && s.industry !== industryFilter) return false;
      if (!q) return true;
      return (
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.industry || "").toLowerCase().includes(q)
      );
    });
  }, [stocks, query, industryFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const { key, dir } = sort;
    list.sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (key === "price" || key === "changesPercentage") {
        av = Number.isFinite(av) ? av : dir > 0 ? Infinity : -Infinity;
        bv = Number.isFinite(bv) ? bv : dir > 0 ? Infinity : -Infinity;
      } else {
        av = String(av ?? "").toLowerCase();
        bv = String(bv ?? "").toLowerCase();
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
    return list;
  }, [filtered, sort]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of sorted) {
      const ind = s.industry || t("MARKET_UNIVERSE_NO_INDUSTRY");
      if (!map.has(ind)) map.set(ind, []);
      map.get(ind).push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sorted, t]);

  const withPrice = stocks.filter((s) => Number.isFinite(s.price)).length;

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: (prev.dir * -1) : { key, dir: 1 } }
    );
  };

  const sortMark = (key) => (sort.key === key ? (sort.dir > 0 ? " ↑" : " ↓") : "");

  const title =
    market === "sa"
      ? t("MARKET_UNIVERSE_TASI_TITLE")
      : t("MARKET_UNIVERSE_SP500_TITLE");

  return (
    <section className="tp-universe tp-panel tp-span-12">
      <div className="tp-panel-head tp-universe-head">
        <div className="tp-universe-head-text">
          <h2 className="tp-panel-title">{title}</h2>
          <p className="tp-universe-sub">
            {data?.indexLabel || ""} · {t("MARKET_UNIVERSE_SUB")}
          </p>
        </div>
        <div className="tp-universe-badges">
          <span className="tp-universe-badge">{data?.count ?? "—"} {t("MARKET_UNIVERSE_STOCKS")}</span>
          <span className="tp-universe-badge">{data?.industryCount ?? "—"} {t("MARKET_UNIVERSE_INDUSTRIES")}</span>
          <span className="tp-universe-badge tp-universe-badge-muted">
            {t("MARKET_UNIVERSE_CACHE")} {data?.cacheMinutes ?? 20} {t("MARKET_UNIVERSE_MIN")}
          </span>
        </div>
      </div>

      <div className="tp-universe-toolbar">
        <div className="tp-universe-search-wrap">
          <input
            type="search"
            className="tp-universe-search"
            placeholder={t("MARKET_UNIVERSE_SEARCH")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("MARKET_UNIVERSE_SEARCH")}
          />
        </div>
        <select
          className="tp-universe-select"
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          aria-label={t("MARKET_UNIVERSE_FILTER_INDUSTRY")}
        >
          <option value="">{t("MARKET_UNIVERSE_ALL_INDUSTRIES")}</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
        <div className="tp-universe-view-toggle" role="tablist" aria-label={t("MARKET_UNIVERSE_VIEW")}>
          <button
            type="button"
            className={view === "table" ? "active" : ""}
            onClick={() => setView("table")}
          >
            {t("MARKET_UNIVERSE_VIEW_TABLE")}
          </button>
          <button
            type="button"
            className={view === "groups" ? "active" : ""}
            onClick={() => setView("groups")}
          >
            {t("MARKET_UNIVERSE_VIEW_GROUPS")}
          </button>
        </div>
        <button
          type="button"
          className="tp-news-refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? t("LOADING") : t("NEWS_REFRESH")}
        </button>
      </div>

      <div className="tp-universe-meta-bar">
        <span>
          {t("MARKET_UNIVERSE_SHOWING")} <b>{filtered.length}</b> / {stocks.length}
        </span>
        <span>
          {t("MARKET_UNIVERSE_PRICED")}: <b>{withPrice}</b>
        </span>
        {data?.updatedAt ? (
          <span className="tp-universe-updated">
            {t("MARKET_UNIVERSE_UPDATED")} {formatUpdated(data.updatedAt, lang)}
          </span>
        ) : null}
      </div>

      <div className="tp-panel-body tp-universe-body">
        {loading && !data ? (
          <div className="tp-universe-skeleton">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="tp-universe-skel-row" />
            ))}
          </div>
        ) : error ? (
          <div className="tp-news-status tp-news-status-error">{error}</div>
        ) : !sorted.length ? (
          <div className="tp-us-empty">{t("MARKET_UNIVERSE_EMPTY")}</div>
        ) : view === "groups" ? (
          <div className="tp-universe-groups">
            {grouped.map(([industry, rows]) => (
              <details key={industry} className="tp-universe-group" open={grouped.length <= 12}>
                <summary className="tp-universe-group-summary">
                  <span
                    className="tp-universe-industry-pill"
                    style={{
                      background: `hsl(${industryHue(industry)} 55% 94%)`,
                      color: `hsl(${industryHue(industry)} 45% 32%)`,
                      borderColor: `hsl(${industryHue(industry)} 40% 78%)`,
                    }}
                  >
                    {industry}
                  </span>
                  <span className="tp-universe-group-count">{rows.length}</span>
                </summary>
                <div className="tp-universe-group-table-wrap">
                  <table className="tp-universe-table">
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.symbol}>
                          <td>
                            <button type="button" className="tp-us-ticker-btn" onClick={() => onOpen(row.symbol)}>
                              {row.symbol}
                            </button>
                          </td>
                          <td className="tp-universe-name">{row.name}</td>
                          <td className="tp-us-num">
                            {pricePrefix}
                            {fmtPrice(row.price, currency)}
                            {market === "sa" ? " SAR" : ""}
                          </td>
                          <td className={`tp-us-num ${pctClass(row.changesPercentage)}`}>
                            {fmtPct(row.changesPercentage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="tp-universe-table-wrap">
            <table className="tp-universe-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="tp-universe-th-btn" onClick={() => toggleSort("symbol")}>
                      {t("TICKER")}
                      {sortMark("symbol")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="tp-universe-th-btn" onClick={() => toggleSort("name")}>
                      {t("US_MARKET_COL_NAME")}
                      {sortMark("name")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="tp-universe-th-btn" onClick={() => toggleSort("industry")}>
                      {t("MARKET_UNIVERSE_INDUSTRY")}
                      {sortMark("industry")}
                    </button>
                  </th>
                  <th className="tp-us-num">
                    <button type="button" className="tp-universe-th-btn" onClick={() => toggleSort("price")}>
                      {t("PRICE")}
                      {sortMark("price")}
                    </button>
                  </th>
                  <th className="tp-us-num">
                    <button
                      type="button"
                      className="tp-universe-th-btn"
                      onClick={() => toggleSort("changesPercentage")}
                    >
                      {t("US_MARKET_CHANGE_PCT")}
                      {sortMark("changesPercentage")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.symbol}>
                    <td>
                      <button type="button" className="tp-us-ticker-btn" onClick={() => onOpen(row.symbol)}>
                        {row.symbol}
                      </button>
                    </td>
                    <td className="tp-universe-name" title={row.name}>
                      {row.name}
                    </td>
                    <td>
                      {row.industry ? (
                        <span
                          className="tp-universe-industry-pill"
                          style={{
                            background: `hsl(${industryHue(row.industry)} 55% 94%)`,
                            color: `hsl(${industryHue(row.industry)} 45% 32%)`,
                            borderColor: `hsl(${industryHue(row.industry)} 40% 78%)`,
                          }}
                        >
                          {row.industry}
                        </span>
                      ) : (
                        <span className="tp-universe-muted">—</span>
                      )}
                    </td>
                    <td className="tp-us-num">
                      {pricePrefix}
                      {fmtPrice(row.price, currency)}
                      {market === "sa" ? " SAR" : ""}
                    </td>
                    <td className={`tp-us-num ${pctClass(row.changesPercentage)}`}>
                      {fmtPct(row.changesPercentage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
