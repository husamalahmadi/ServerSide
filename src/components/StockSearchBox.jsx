import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { getAllStocks } from "../data/stocksCatalog.js";
import { filterStocksByQuery } from "../domain/stockSearch.js";

function marketBadge(market) {
  if (market === "sa") return "TASI";
  if (market === "jp") return "TOKYO";
  if (market === "uk") return "LSE";
  return "US";
}

/**
 * Stock ticker search with market filter and autocomplete (homepage + topbar).
 */
export function StockSearchBox({
  variant = "section",
  catalogItems: externalItems,
  catalogLoading: externalLoading,
  catalogError: externalError,
  query: controlledQuery,
  onQueryChange,
  marketFilter: controlledMarket,
  onMarketFilterChange,
  className = "",
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const wrapRef = useRef(null);

  const [internalQ, setInternalQ] = useState("");
  const [internalMarket, setInternalMarket] = useState("all");
  const q = controlledQuery !== undefined ? controlledQuery : internalQ;
  const setQ = onQueryChange || setInternalQ;
  const marketFilter = controlledMarket !== undefined ? controlledMarket : internalMarket;
  const setMarketFilter = onMarketFilterChange || setInternalMarket;
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [internal, setInternal] = useState({ loading: !externalItems, error: "", items: externalItems || [] });

  const useExternal = externalItems != null;

  useEffect(() => {
    if (useExternal) return;
    let alive = true;
    (async () => {
      try {
        setInternal((s) => ({ ...s, loading: true, error: "" }));
        const json = await getAllStocks();
        if (!alive) return;
        setInternal({ loading: false, error: "", items: json?.items || [] });
      } catch (e) {
        if (!alive) return;
        setInternal({ loading: false, error: t("ERR_LOAD_STOCKS"), items: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [t, useExternal]);

  const items = useExternal ? externalItems : internal.items;
  const loading = useExternal ? Boolean(externalLoading) : internal.loading;
  const error = useExternal ? externalError || "" : internal.error;

  const marketCounts = useMemo(() => {
    const counts = { us: 0, sa: 0, jp: 0, uk: 0 };
    for (const it of items) {
      if (it.market in counts) counts[it.market] += 1;
    }
    return counts;
  }, [items]);

  const searchQuery = q.trim();
  const suggestions = useMemo(
    () => filterStocksByQuery(items, searchQuery, { market: marketFilter, limit: 8 }),
    [items, searchQuery, marketFilter]
  );

  const handleClickOutside = useCallback((e) => {
    if (wrapRef.current && !wrapRef.current.contains(e.target)) {
      setSuggestionsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (String(q || "").trim()) setSuggestionsOpen(true);
  }, [q]);

  function bestSearchMatch() {
    return filterStocksByQuery(items, searchQuery, { market: marketFilter, limit: 1 })[0] || null;
  }

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
      if (suggestions.length > 0) pickSuggestion(suggestions[0]);
      else if (searchQuery) {
        const match = bestSearchMatch();
        if (match) goToStock(match.ticker);
      }
    }
  }

  function toggleMarketFilter(market) {
    setMarketFilter((prev) => (prev === market ? "all" : market));
  }

  function runSearch() {
    if (suggestions.length > 0) pickSuggestion(suggestions[0]);
    else if (searchQuery) {
      const match = bestSearchMatch();
      if (match) goToStock(match.ticker);
    }
  }

  const marketPills = (
    <div className={`tp-market-strip${variant === "topbar" ? " tp-market-strip--topbar" : ""}`}>
      <button
        type="button"
        className={`tp-market-pill us${marketFilter === "us" ? " active" : ""}`}
        onClick={() => toggleMarketFilter("us")}
      >
        {t("MARKET_US")}
        {variant !== "topbar" ? (
          <span className="tp-mp-count">{marketCounts.us.toLocaleString()}</span>
        ) : null}
      </button>
      <button
        type="button"
        className={`tp-market-pill sa${marketFilter === "sa" ? " active" : ""}`}
        onClick={() => toggleMarketFilter("sa")}
      >
        {t("MARKET_SA")}
        {variant !== "topbar" ? (
          <span className="tp-mp-count">{marketCounts.sa.toLocaleString()}</span>
        ) : null}
      </button>
      <button
        type="button"
        className={`tp-market-pill jp${marketFilter === "jp" ? " active" : ""}`}
        onClick={() => toggleMarketFilter("jp")}
      >
        {t("MARKET_JP")}
        {variant !== "topbar" ? (
          <span className="tp-mp-count">{marketCounts.jp.toLocaleString()}</span>
        ) : null}
      </button>
      <button
        type="button"
        className={`tp-market-pill uk${marketFilter === "uk" ? " active" : ""}`}
        onClick={() => toggleMarketFilter("uk")}
      >
        {t("MARKET_UK")}
        {variant !== "topbar" ? (
          <span className="tp-mp-count">{marketCounts.uk.toLocaleString()}</span>
        ) : null}
      </button>
    </div>
  );

  const searchField = (
    <div ref={wrapRef} className="tp-search-autocomplete">
      <div className={`tp-search-box${variant === "topbar" ? " tp-search-box--topbar" : ""}`}>
        <div className="tp-field-wrap">
          <input
            className="tp-ticker-field"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={t("SEARCH_PLACEHOLDER")}
            maxLength={32}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen && searchQuery.length > 0}
            role="combobox"
          />
          <div
            className={`tp-suggestions ${suggestionsOpen && searchQuery.length > 0 ? "open" : ""}`}
            role="listbox"
          >
            {loading ? (
              <div className="tp-sug-empty">{t("LOADING")}</div>
            ) : error ? (
              <div className="tp-sug-empty">{error}</div>
            ) : suggestions.length === 0 ? (
              <div className="tp-sug-empty">{t("NO_MATCH")}</div>
            ) : (
              suggestions.map((it) => (
                <div
                  key={`${it.ticker}-${it.market || ""}`}
                  className="tp-sug-item"
                  role="option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(it)}
                >
                  <span className="tp-sug-ticker">{it.ticker}</span>
                  <span className="tp-sug-name">
                    {it.name} · {marketBadge(it.market)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <button type="button" className="tp-go-btn" onClick={runSearch}>
          {lang === "ar" ? "تحليل ←" : "Analyze →"}
        </button>
      </div>
    </div>
  );

  if (variant === "topbar") {
    return (
      <div className={`tp-topbar-search-wrap ${className}`.trim()}>
        {marketPills}
        {searchField}
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="tp-markets-heading">{t("HOME_MARKETS_HEADING")}</h3>
      {marketPills}
      {searchField}
    </div>
  );
}
