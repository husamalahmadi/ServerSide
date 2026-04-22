// FILE: src/routes/Home.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { getAllStocks } from "../data/stocksCatalog.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { PillLink } from "../components/PillLink.jsx";
import { LangToggle } from "../components/LangToggle.jsx";
import { usePageMeta } from "../hooks/usePageMeta.js";
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
        .tp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }
        .tp-search-section {
          padding: 52px 0 40px;
          border: 1px solid var(--tp-border);
          border-radius: 16px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          margin-top: 24px;
        }
        .tp-search-headline {
          font-family: 'Inter', 'Barlow', sans-serif;
          font-size: clamp(30px, 4vw, 54px);
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 14px;
          color: var(--tp-ink);
          padding: 0 36px;
        }
        .tp-search-headline em { font-style: normal; color: var(--tp-accent); }
        .tp-search-deck {
          font-size: 16px;
          color: var(--tp-muted);
          margin-bottom: 28px;
          line-height: 1.65;
          max-width: 640px;
          padding: 0 36px;
        }
        .tp-search-box {
          display: flex;
          gap: 0;
          max-width: 680px;
          border: 1px solid var(--tp-border);
          border-radius: 12px;
          background: var(--tp-surface);
          margin: 0 36px;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06);
        }
        .tp-field-wrap { position: relative; flex: 1; }
        .tp-ticker-field {
          width: 100%;
          border: none;
          outline: none;
          padding: 16px 18px;
          font-family: 'Inter', sans-serif;
          font-size: 16px;
          letter-spacing: 0.2px;
          background: transparent;
          color: var(--tp-ink);
        }
        .tp-ticker-field::placeholder { color: var(--tp-muted); letter-spacing: 0; font-size: 14px; }
        .tp-go-btn {
          background: #0f172a;
          color: #fff;
          border: none;
          padding: 16px 28px;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.8px;
          cursor: pointer;
          transition: background 0.15s;
          border-radius: 0 12px 12px 0;
        }
        .tp-go-btn:hover { background: #1e293b; }
        .tp-suggestions {
          position: absolute;
          top: 100%; left: 0; right: 0;
          background: var(--tp-surface);
          border: 1px solid var(--tp-border);
          border-top: none;
          z-index: 50;
          display: none;
          border-radius: 0 0 10px 10px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
        }
        .tp-suggestions.open { display: block; }
        .tp-sug-item {
          padding: 10px 18px;
          display: flex;
          gap: 12px;
          align-items: center;
          cursor: pointer;
          font-size: 13px;
          border-bottom: 1px solid var(--tp-border);
          transition: background 0.1s;
        }
        .tp-sug-item:last-child { border-bottom: none; }
        .tp-sug-item:hover { background: var(--tp-surface2); }
        .tp-sug-ticker { font-weight: 700; color: var(--tp-accent); min-width: 50px; }
        .tp-sug-name { color: var(--tp-muted); }
        .tp-quick-picks { margin-top: 18px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 0 36px; }
        .tp-qp-label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--tp-muted); }
        .tp-qp-chip {
          border: 1px solid var(--tp-border);
          background: var(--tp-surface);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          letter-spacing: 0.2px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'Inter', sans-serif;
        }
        .tp-qp-chip:hover { background: var(--tp-surface2); color: var(--tp-ink); border-color: var(--tp-muted); }
        .tp-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; margin-bottom: 16px; color: var(--tp-ink); }
        .tp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
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
        @media (max-width: 720px) {
          .tp-search-headline,
          .tp-search-deck,
          .tp-search-box,
          .tp-quick-picks { padding-left: 16px; padding-right: 16px; margin-left: 0; margin-right: 0; }
          .tp-go-btn { padding: 14px 18px; }
          .tp-search-headline { font-size: clamp(26px, 8vw, 38px); }
          .tp-search-deck { font-size: 14px; }
        }
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
