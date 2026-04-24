// FILE: src/routes/Home.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { getAllStocks } from "../data/stocksCatalog.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { PillLink } from "../components/PillLink.jsx";
import { LangToggle } from "../components/LangToggle.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { getScreenerDataset } from "../services/screenerService.js";
import { useScreener } from "../hooks/useScreener.js";
import { ScreenerFilters } from "../components/screener/ScreenerFilters.jsx";
import { ScreenerResultsTable } from "../components/screener/ScreenerResultsTable.jsx";
function normalize(s) {
  return (s || "").toString().trim().toLowerCase();
}

const QUICK_PICKS = [
  { ticker: "AAPL", name: "Apple", market: "us" },
  { ticker: "MSFT", name: "Microsoft", market: "us" },
  { ticker: "2222", name: "Saudi Aramco", market: "sa" },
  { ticker: "1120", name: "Al Rajhi Bank", market: "sa" },
  { ticker: "NVDA", name: "NVIDIA", market: "us" },
  { ticker: "1180", name: "SNB", market: "sa" },
  { ticker: "2010", name: "SABIC", market: "sa" },
  { ticker: "AMZN", name: "Amazon", market: "us" },
];

export default function Home() {
  const { t, lang, dir, toggleLang } = useI18n();
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
  usePageMeta({
    title: "TruePrice.Cash",
    description: t("MARKET_US") + " & " + t("MARKET_SA") + ". " + t("COMPANIES") + ".",
    pathname: "/",
  });

  const [q, setQ] = useState("");
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
  });
  const initialScreenerFilters = useMemo(() => {
    const readNum = (k, fallback) => {
      const v = Number(searchParams.get(k));
      return Number.isFinite(v) ? v : fallback;
    };
    return {
      market: searchParams.get("sm") || "all",
      sector: searchParams.get("ss") || "all",
      query: searchParams.get("sq") || "",
      peMin: readNum("spemin", 0),
      peMax: readNum("spemax", 60),
      marketCapMin: readNum("smcmin", 0),
      marketCapMax: readNum("smcmax", 5000000000000),
      discountMin: readNum("sdmin", -80),
      discountMax: readNum("sdmax", 200),
    };
  }, [searchParams]);

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
    return () => { alive = false; };
  }, [t]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setScreenerState({ loading: true, error: "", items: [], sectors: [] });
        const data = await getScreenerDataset();
        if (!alive) return;
        setScreenerState({
          loading: false,
          error: "",
          items: data?.items || [],
          sectors: data?.sectors || [],
        });
      } catch {
        if (!alive) return;
        setScreenerState({ loading: false, error: t("SCREENER_LOAD_FAILED"), items: [], sectors: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const { filters, setFilters, sortBy, sortDir, onSort, applyPreset, filteredCount, items: screenerItems } =
    useScreener(screenerState.items, initialScreenerFilters);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("sm", filters.market);
    next.set("ss", filters.sector);
    if (filters.query) next.set("sq", filters.query);
    else next.delete("sq");
    next.set("spemin", String(filters.peMin));
    next.set("spemax", String(filters.peMax));
    next.set("smcmin", String(filters.marketCapMin));
    next.set("smcmax", String(filters.marketCapMax));
    next.set("sdmin", String(filters.discountMin));
    next.set("sdmax", String(filters.discountMax));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

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

  const suggestions = useMemo(() => {
    const query = normalize(q);
    if (!query || query.length < 1) return [];
    const items = Array.isArray(state.items) ? state.items : [];
    return items
      .filter((it) => {
        const name = normalize(it?.name);
        const ticker = String(it?.ticker ?? "");
        const tickerNorm = normalize(ticker);
        return name.includes(query) || tickerNorm.includes(query) || ticker === q;
      })
      .slice(0, 8);
  }, [state.items, q]);

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
      } else if (q.trim()) {
        const match = state.items.find(
          (it) =>
            String(it.ticker).toLowerCase() === q.trim().toLowerCase() ||
            normalize(it.name).includes(normalize(q))
        );
        if (match) goToStock(match.ticker);
      }
    }
  }

  return (
    <div dir={dir} lang={lang} style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
      <style>{`
        .tp-wrap { max-width: 1220px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }
        .tp-search-section { padding: 40px 0 32px; border-bottom: 1px solid var(--tp-border); }
        .tp-search-headline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(22px, 4vw, 36px);
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 8px;
          color: var(--tp-ink);
        }
        .tp-search-headline em { font-style: italic; color: var(--tp-gold); }
        .tp-search-deck { font-size: 12px; color: var(--tp-muted); margin-bottom: 28px; line-height: 1.7; max-width: 520px; }
        .tp-search-box {
          display: flex;
          gap: 0;
          max-width: 560px;
          border: 2px solid var(--tp-ink);
          background: var(--tp-surface);
        }
        .tp-field-wrap { position: relative; flex: 1; }
        .tp-ticker-field {
          width: 100%;
          border: none;
          outline: none;
          padding: 14px 18px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 16px;
          letter-spacing: 2px;
          background: transparent;
          color: var(--tp-ink);
        }
        .tp-ticker-field::placeholder { color: var(--tp-muted); letter-spacing: 0; font-size: 13px; }
        .tp-go-btn {
          background: var(--tp-accent);
          color: #fff;
          border: none;
          padding: 14px 28px;
          font-family: 'Barlow', sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 2px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .tp-go-btn:hover { background: #2d5a40; }
        .tp-suggestions {
          position: absolute;
          top: 100%; left: 0; right: 0;
          background: var(--tp-surface);
          border: 2px solid var(--tp-ink);
          border-top: none;
          z-index: 50;
          display: none;
        }
        .tp-suggestions.open { display: block; }
        .tp-sug-item {
          padding: 10px 18px;
          display: flex;
          gap: 12px;
          align-items: center;
          cursor: pointer;
          font-size: 12px;
          border-bottom: 1px solid var(--tp-border);
          transition: background 0.1s;
        }
        .tp-sug-item:last-child { border-bottom: none; }
        .tp-sug-item:hover { background: var(--tp-surface2); }
        .tp-sug-ticker { font-weight: 500; color: var(--tp-accent); min-width: 50px; }
        .tp-sug-name { color: var(--tp-muted); }
        .tp-quick-picks { margin-top: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .tp-qp-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--tp-muted); }
        .tp-qp-chip {
          border: 1px solid var(--tp-border);
          background: var(--tp-surface);
          padding: 4px 12px;
          font-size: 11px;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'IBM Plex Mono', monospace;
        }
        .tp-qp-chip:hover { background: var(--tp-accent); color: #fff; border-color: var(--tp-accent); }
        .tp-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; margin-bottom: 16px; color: var(--tp-ink); }
        .tp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
        .tp-screener-section { padding: 28px 0; border-bottom: 1px solid var(--tp-border); }
        .tp-scr-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
        .tp-scr-count { font-size: 12px; color: var(--tp-muted); font-weight: 600; }
        .tp-scr-presets { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; }
        .tp-scr-preset {
          border: 1px solid var(--tp-border);
          background: var(--tp-surface);
          padding: 6px 11px;
          font-size: 11px;
          cursor: pointer;
          border-radius: 999px;
          font-weight: 600;
        }
        .tp-scr-preset:hover { background: var(--tp-accent); color: #fff; border-color: var(--tp-accent); }
        .tp-scr-summary {
          position: sticky;
          top: 0;
          z-index: 10;
          margin: 0 0 12px;
          border: 1px solid var(--tp-border);
          background: #fff;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          color: var(--tp-muted);
        }
        .tp-scr-layout { display: grid; grid-template-columns: 1fr; gap: 12px; align-items: start; }
        .tp-scr-filters {
          border: 1px solid var(--tp-border);
          border-radius: 10px;
          background: var(--tp-surface);
          padding: 14px;
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 12px;
          align-items: end;
        }
        .tp-scr-filters > .tp-scr-row { grid-column: span 4; }
        .tp-scr-row { display: grid; gap: 7px; min-width: 0; }
        .tp-scr-row label { font-size: 11px; letter-spacing: 1px; color: var(--tp-muted); text-transform: uppercase; }
        .tp-scr-row input, .tp-scr-row select {
          border: 1px solid var(--tp-border);
          padding: 9px 10px;
          background: #fff;
          font-size: 13px;
          border-radius: 8px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .tp-scr-row small { color: var(--tp-muted); font-size: 11px; }
        .tp-scr-inline { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 6px; align-items: center; min-width: 0; }
        .tp-scr-hint {
          margin: 2px 2px 0;
          font-size: 11px;
          color: var(--tp-muted);
        }
        .tp-scr-table-wrap {
          border: 1px solid var(--tp-border);
          border-radius: 10px;
          overflow: auto;
          background: var(--tp-surface);
          max-height: 620px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .tp-scr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .tp-scr-table th, .tp-scr-table td { padding: 9px 10px; border-bottom: 1px solid var(--tp-border); text-align: start; white-space: nowrap; vertical-align: middle; }
        .tp-scr-table thead th {
          background: #f8f6f1;
          font-size: 11px;
          letter-spacing: .5px;
          text-transform: uppercase;
          color: var(--tp-muted);
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .tp-scr-table tbody tr:nth-child(even) { background: rgba(0,0,0,0.012); }
        .tp-scr-table tbody tr:hover { background: #f4f8f4; }
        .tp-scr-link { border: none; background: transparent; color: var(--tp-accent); cursor: pointer; font-weight: 700; font-family: 'IBM Plex Mono', monospace; padding: 0; }
        .tp-scr-ticker-cell { font-family: 'IBM Plex Mono', monospace; font-weight: 600; }
        .tp-scr-company-cell, .tp-scr-sector-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
        .tp-scr-num { text-align: end !important; font-variant-numeric: tabular-nums; }
        .tp-scr-pos { color: #166534; font-weight: 700; }
        .tp-scr-neg { color: #991b1b; font-weight: 700; }
        .tp-scr-market-badge {
          display: inline-block;
          min-width: 48px;
          text-align: center;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .4px;
        }
        .tp-scr-market-badge.us { color: #1d4ed8; background: #eff6ff; }
        .tp-scr-market-badge.sa { color: #166534; background: #ecfdf3; }
        .tp-scr-empty { border: 1px dashed var(--tp-border); padding: 20px; color: var(--tp-muted); text-align: center; }
        @media (max-width: 1180px) {
          .tp-scr-filters { grid-template-columns: repeat(12, minmax(0, 1fr)); }
          .tp-scr-filters > .tp-scr-row { grid-column: span 6; }
        }
        @media (max-width: 980px) {
          .tp-wrap { padding: 0 14px; }
          .tp-scr-filters { grid-template-columns: repeat(12, minmax(0, 1fr)); }
          .tp-scr-filters > .tp-scr-row { grid-column: span 6; }
          .tp-scr-company-cell, .tp-scr-sector-cell { max-width: 140px; }
        }
        @media (max-width: 640px) {
          .tp-scr-filters { grid-template-columns: repeat(12, minmax(0, 1fr)); }
          .tp-scr-filters > .tp-scr-row { grid-column: span 12; }
        }
        .tp-company {
          text-align: start;
          border: 1px solid var(--tp-border);
          padding: 12px;
          background: var(--tp-surface);
          cursor: pointer;
          transition: all 0.15s;
        }
        .tp-company:hover { border-color: var(--tp-accent); background: var(--tp-surface2); }
        .tp-company-name { font-weight: 700; color: var(--tp-ink); font-family: 'Barlow', sans-serif; }
        .tp-company-meta { font-size: 12px; color: var(--tp-muted); margin-top: 6px; line-height: 1.35; }
      `}</style>

      <div className="tp-wrap">
        <PageHeader title="TruePrice.Cash" subtitle="Equity Intelligence · US & TASI Markets">
          <PillLink to="/blogs" ariaLabel={t("BLOGS")}>{t("BLOGS")}</PillLink>
          <PillLink to="/about" ariaLabel={t("ABOUT_US")}>{t("ABOUT_US")}</PillLink>
          <PillLink to="/contact" ariaLabel={t("CONTACT_US")}>{t("CONTACT_US")}</PillLink>
          <LangToggle lang={lang} onToggle={toggleLang} t={t} />
        </PageHeader>

        {authParam === "not_configured" && (
          <div
            role="status"
            style={{
              margin: "0 0 20px",
              padding: "14px 16px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              fontSize: 13,
              color: "#991b1b",
              lineHeight: 1.55,
            }}
          >
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
          <div
            role="status"
            style={{
              margin: "0 0 20px",
              padding: "14px 16px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              fontSize: 13,
              color: "#991b1b",
            }}
          >
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

        {/* Search */}
        <div className="tp-search-section">
          <h1 className="tp-search-headline">
            {lang === "ar" ? "تحليل عادل" : "Institutional-grade"}
            <br />
            <em>{lang === "ar" ? "أي سهم أمريكي أو سعودي" : "any US or TASI stock"}</em>
          </h1>
          <p className="tp-search-deck">
            {lang === "ar"
              ? "أدخل الرمز أو اسم الشركة. نحلل القوائم المالية ونقدّر القيمة العادلة."
              : "Enter a ticker or company name. We analyze financials and estimate fair value — instantly."}
          </p>

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
                      <span className="tp-sug-name">{it.name} · {it.market === "sa" ? "TASI" : "US"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="tp-go-btn"
                onClick={() => {
                  if (suggestions.length > 0) pickSuggestion(suggestions[0]);
                  else if (q.trim()) {
                    const match = state.items.find(
                      (it) =>
                        String(it.ticker).toLowerCase() === q.trim().toLowerCase() ||
                        normalize(it.name).includes(normalize(q))
                    );
                    if (match) goToStock(match.ticker);
                  }
                }}
              >
                {lang === "ar" ? "تحليل →" : "ANALYZE →"}
              </button>
            </div>
          </div>

          <div className="tp-quick-picks">
            <span className="tp-qp-label">{lang === "ar" ? "جرب:" : "Try:"}</span>
            {QUICK_PICKS.map((p) => (
              <span
                key={p.ticker}
                className="tp-qp-chip"
                onClick={() => goToStock(p.ticker)}
              >
                {p.ticker}
              </span>
            ))}
          </div>
        </div>

        <div className="tp-screener-section">
          <div className="tp-scr-head">
            <h2 className="tp-title" style={{ margin: 0 }}>{t("SCREENER_TITLE")}</h2>
            <div className="tp-scr-count">{t("SCREENER_MATCHES")}: {filteredCount}</div>
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
            <button type="button" className="tp-scr-preset" onClick={() => applyPreset("reset")}>
              {t("RESET")}
            </button>
          </div>
          <div className="tp-scr-summary">
            <span>{t("SCREENER_MATCHES")}: <b>{filteredCount}</b></span>
            <span>{t("SCREENER_AVG_DISCOUNT")}: <b>{screenerSummary.avgDiscount == null ? "—" : `${screenerSummary.avgDiscount.toFixed(1)}%`}</b></span>
            <span>{t("SCREENER_TOP_SECTOR")}: <b>{screenerSummary.topSector}</b></span>
          </div>
          {screenerState.loading ? (
            <div className="tp-scr-empty">{t("LOADING")}</div>
          ) : screenerState.error ? (
            <div className="tp-scr-empty">{screenerState.error}</div>
          ) : (
            <div className="tp-scr-layout">
              <ScreenerFilters t={t} filters={filters} setFilters={setFilters} sectors={screenerState.sectors} />
              <div className="tp-scr-hint">
                {lang === "ar" ? "لا حاجة لزر: النتائج تتحدث تلقائيًا عند تغيير المعايير." : "No button needed: results update automatically when you change criteria."}
              </div>
              {screenerItems.length === 0 ? (
                <div className="tp-scr-empty">{t("NO_MATCH")}</div>
              ) : (
                <ScreenerResultsTable
                  t={t}
                  items={screenerItems}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  onOpenTicker={goToStock}
                />
              )}
            </div>
          )}
        </div>

        <footer
          style={{
            marginTop: 24,
            padding: "14px 4px",
            textAlign: "center",
            color: "var(--tp-muted)",
            fontSize: 12,
          }}
        >
          © TruePrice.Cash
        </footer>
      </div>
    </div>
  );
}
