import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { getCompany, resolveMarketAndSymbol } from "../data/stocksCatalog.js";
import { getLivePrice } from "../services/priceService.js";
import { getFinancialsCached } from "../services/financialsService.js";
import { computeValuation } from "../domain/valuation.js";
import { twelveLogo, twelveProfile } from "../services/twelveData.js";
import { translateToArabic } from "../services/translateService.js";
import { Card } from "../components/Card.jsx";
import { PillLink } from "../components/PillLink.jsx";
import { LangToggle } from "../components/LangToggle.jsx";
import { RetryButton } from "../components/RetryButton.jsx";
import { CompareBar, ChartBlock } from "../components/stock/StockCharts.jsx";
import { fmt2, fmtBill, trendText } from "../domain/formatting.js";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { useFavorites } from "../hooks/useFavorites.js";
import { getPrefetchDelayMs } from "../config/env.js";

const PREFETCH_DELAY_SEC = Math.ceil(getPrefetchDelayMs() / 1000);

/* Page */
export default function Stock() {
  const { ticker } = useParams();
  const { t, lang, dir, toggleLang } = useI18n();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [shareCopied, setShareCopied] = useState(false);
  usePageMeta({ title: ticker ? `${ticker} – ${t("REPORT")}` : t("REPORT"), description: t("FAIR_VALUE_SECTION") + ". " + t("EXEC_SUM") + "." });
  const isMobile = useIsMobile(700);

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: t("REPORT"), url }).then(() => setShareCopied(true)).catch(() => copyToClipboard(url));
    } else {
      copyToClipboard(url);
    }
  };
  const handlePrint = () => window.print();

  const [company, setCompany] = useState("");
  const [market, setMarket] = useState("us");
  const [currency, setCurrency] = useState("USD");
  const [price, setPrice] = useState(null);
  const [headerError, setHeaderError] = useState("");

  const [fin, setFin] = useState({ loading: false, error: "", data: null });
  const [val, setVal] = useState({ loading: false, error: "", data: null });
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [profile, setProfile] = useState(null);
  const [translatedProfile, setTranslatedProfile] = useState(null);
  const [prefetchCountdown, setPrefetchCountdown] = useState(PREFETCH_DELAY_SEC);

  const reportDate = useMemo(() => new Date().toLocaleDateString(), []);

  // Company info: immediate (no TwelveData)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setHeaderError("");
        const cj = await getCompany(ticker);
        if (!alive) return;
        setCompany(cj?.name || "");
        setMarket(cj?.market || "us");
        setCurrency(cj?.currency || "USD");
      } catch (e) {
        if (!alive) return;
        setHeaderError(String(e?.message || e));
      }
    })();
    return () => { alive = false; };
  }, [ticker]);

  // Price: LIVE ONLY (no cache)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setHeaderError("");
        const pj = await getLivePrice({ ticker, market, cache: "no-store" });
        if (!alive) return;
        setPrice(Number(pj?.price));
      } catch (e) {
        if (!alive) return;
        setHeaderError(String(e?.message || e));
      }
    })();
    return () => { alive = false; };
  }, [ticker, market]);

  const loadFinancials = useCallback(async () => {
    try {
      setFin({ loading: true, error: "", data: null });
      const j = await getFinancialsCached({ ticker, market });
      setFin({ loading: false, error: "", data: j });
    } catch (e) {
      setFin({ loading: false, error: t("ERR_STATEMENTS"), data: null });
    }
  }, [ticker, market, t]);

  const loadValuation = useCallback(async () => {
    try {
      setVal({ loading: true, error: "", data: null });
      const j = await computeValuation({ ticker, market, cache: "no-store" });
      setVal({ loading: false, error: "", data: j });
    } catch (e) {
      setVal({ loading: false, error: t("ERR_VALUATION"), data: null });
    }
  }, [ticker, market, t]);

  // Prefetch delay: wait PREFETCH_DELAY_SEC then load financials and valuation
  useEffect(() => {
    setPrefetchCountdown(PREFETCH_DELAY_SEC);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, PREFETCH_DELAY_SEC - elapsed);
      setPrefetchCountdown(left);
      if (left <= 0) {
        clearInterval(interval);
        loadFinancials();
        loadValuation();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [ticker, market, loadFinancials, loadValuation]);

  // Logo & profile
  useEffect(() => {
    let alive = true;
    setLogoLoadError(false);
    (async () => {
      try {
        const r = await resolveMarketAndSymbol(ticker, market);
        if (!r.ok || !alive) return;
        const symbol = r.symbol;
        const [logoRes, profileRes] = await Promise.all([
          twelveLogo(symbol),
          twelveProfile(symbol),
        ]);
        if (!alive) return;
        const base = logoRes?.logo_base;
        setLogoUrl(base && typeof base === "string" ? base : null);
        setProfile(profileRes && typeof profileRes === "object" ? profileRes : null);
      } catch {
        if (!alive) return;
        setLogoUrl(null);
        setProfile(null);
      }
    })();

    return () => { alive = false; };
  }, [ticker, market]);

  // Translate profile to Arabic when lang is ar
  useEffect(() => {
    let alive = true;
    if (!profile || lang !== "ar") {
      setTranslatedProfile(null);
      return;
    }
    setTranslatedProfile(null);
    (async () => {
      const str = (v) => (v && String(v).trim()) || "";
      const n = str(profile.name), ind = str(profile.industry), sec = str(profile.sector);
      const desc = str(profile.description), co = str(profile.country), ci = str(profile.city), ceo = str(profile.CEO);
      try {
        const [name, industry, sector, description, country, city, ceoTr] = await Promise.all([
          n ? translateToArabic(n) : Promise.resolve(""),
          ind ? translateToArabic(ind) : Promise.resolve(""),
          sec ? translateToArabic(sec) : Promise.resolve(""),
          desc ? translateToArabic(desc) : Promise.resolve(""),
          co ? translateToArabic(co) : Promise.resolve(""),
          ci ? translateToArabic(ci) : Promise.resolve(""),
          ceo ? translateToArabic(ceo) : Promise.resolve(""),
        ]);
        if (!alive) return;
        setTranslatedProfile({
          name: name || profile.name,
          industry: industry || profile.industry,
          sector: sector || profile.sector,
          description: description || profile.description,
          country: country || profile.country,
          city: city || profile.city,
          CEO: ceoTr || profile.CEO,
        });
      } catch {
        if (!alive) return;
        setTranslatedProfile(null);
      }
    })();
    return () => { alive = false; };
  }, [profile, lang]);

  const years = useMemo(() => fin?.data?.years || [], [fin]);
  const toSeries = (k) =>
    years
      .map((y) => ({ label: String(y.year), value: Number(y[k]) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => Number(a.label) - Number(b.label));

  const serRevenue = useMemo(() => toSeries("revenue"), [years]);
  const serOp = useMemo(() => toSeries("operatingIncome"), [years]);
  const serNet = useMemo(() => toSeries("netIncome"), [years]);
  const serEquity = useMemo(() => toSeries("totalEquity"), [years]);
  const serFCF = useMemo(() => toSeries("freeCashFlow"), [years]);

  const fair = val?.data;
  const fairAvg = useMemo(() => {
    const arr = [fair?.fairEV, fair?.fairPS, fair?.fairPE]
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    if (!arr.length) return null;
    return arr.reduce((s, n) => s + n, 0) / arr.length;
  }, [fair]);

  const chartW = isMobile ? 320 : 380;
  const bigChartW = isMobile ? 320 : 480;

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }} dir={dir} lang={lang}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16, overflowX: "hidden" }}>
        {/* Banner */}
        <div
          className="no-print"
          style={{
            background: "#111827",
            color: "#fff",
            borderRadius: 16,
            padding: 14,
            marginBottom: 16,
            boxShadow: "0 1px 10px rgba(0,0,0,0.10)",
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            gap: 12,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 320px" }}>
            {logoUrl && !logoLoadError ? (
              <img
                src={logoUrl}
                alt=""
                referrerPolicy="no-referrer"
                style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, background: "#fff", flexShrink: 0 }}
                onError={() => setLogoLoadError(true)}
              />
            ) : null}
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, overflowWrap: "anywhere" }}>
                {(lang === "ar" && translatedProfile?.name) || profile?.name || company || t("NOT_AVAILABLE")}
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", overflowWrap: "anywhere" }}>
                <b>{t("TICKER")}:</b> {ticker} · <b>{t("REPORT_DATE")}:</b> {reportDate}
              </div>
            </div>
          </div>

          <div
            className="no-print"
            style={{
              marginInlineStart: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: isMobile ? "space-between" : "flex-end",
              width: isMobile ? "100%" : "auto",
              minWidth: 0,
            }}
          >
            <div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>
              {t("PRICE")}:{" "}
              {headerError ? (
                <span style={{ color: "#fecaca" }}>{headerError}</span>
              ) : price == null ? (
                t("LOADING")
              ) : (
                `${fmt2(price)} ${currency}`
              )}
            </div>
            <button
              type="button"
              onClick={() => ticker && toggleFavorite(ticker)}
              aria-label={isFavorite(ticker) ? t("REMOVE_FAVORITE") : t("ADD_FAVORITE")}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                padding: "6px 10px",
                background: "#fff",
                color: isFavorite(ticker) ? "#b45309" : "#6b7280",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              {isFavorite(ticker) ? "★" : "☆"}
            </button>
            <button
              type="button"
              onClick={handleShare}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                padding: "6px 10px",
                fontWeight: 700,
                background: "#fff",
                color: "#111827",
                cursor: "pointer",
              }}
            >
              {shareCopied ? t("SHARE_COPIED") : t("SHARE_REPORT")}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                padding: "6px 10px",
                fontWeight: 700,
                background: "#fff",
                color: "#111827",
                cursor: "pointer",
              }}
            >
              {t("PRINT_REPORT")}
            </button>
            <PillLink to="/" ariaLabel={t("DASHBOARD")}>Trueprice.cash</PillLink>
            <LangToggle lang={lang} onToggle={toggleLang} t={t} />
          </div>
        </div>

        {/* 1. Executive Summary */}
        <Card title={t("EXEC_SUM")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : fin.loading && !fin.data ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr",
                gap: 16,
                alignItems: "start",
                minWidth: 0,
              }}
            >
              <ul style={{ margin: 0, paddingInlineStart: 18, minWidth: 0 }}>
                <li style={{ overflowWrap: "anywhere" }}><b>{t("REV_GROWTH")}:</b> {trendText(serRevenue, t)}</li>
                <li style={{ overflowWrap: "anywhere" }}><b>{t("OP_INCOME")}:</b> {trendText(serOp, t)}</li>
                <li style={{ overflowWrap: "anywhere" }}><b>{t("NET_INCOME")}:</b> {trendText(serNet, t)}</li>
                <li style={{ overflowWrap: "anywhere" }}><b>{t("FCF")}:</b> {trendText(serFCF, t)}</li>
                <li style={{ overflowWrap: "anywhere" }}>
                  <b>{t("STOCK_VALUATION")}:</b> {t("FAIR_ABBR")} ≈ {fmt2(fairAvg)} {currency}
                </li>
              </ul>

              <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", minWidth: 0 }}>
                <CompareBar current={price ?? 0} fair={fairAvg ?? 0} currency={currency} dir={dir} t={t} />
              </div>
            </div>
          )}
        </Card>

        {/* 2. Fair value analysis */}
        <Card title={t("FAIR_VALUE_SECTION")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : val.loading && !val.data ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : val.error ? (
            <div style={{ color: "#b91c1c" }}>
              {val.error}
              <RetryButton onRetry={loadValuation} t={t} />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr",
                gap: 16,
                alignItems: "start",
                minWidth: 0,
              }}
            >
              <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                <div style={{ overflowWrap: "anywhere" }}><b>{t("CUR_PRICE")}:</b> {fmt2(price)} {currency}</div>
                <div style={{ overflowWrap: "anywhere" }}><b>{t("FAIR_AVG")}:</b> {fmt2(fairAvg)} {currency}</div>

                <div style={{ marginTop: 10, fontWeight: 900 }}>{t("VAL_METHODS")}</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 6,
                    maxWidth: 520,
                    minWidth: 0,
                  }}
                >
                  <div style={{ overflowWrap: "anywhere" }}>{t("EV_SHARE")}</div>
                  <div style={{ fontWeight: 800, textAlign: "end" }}>{fmt2(fair?.fairEV)} {currency}</div>

                  <div style={{ overflowWrap: "anywhere" }}>{t("PS_BASED")}</div>
                  <div style={{ fontWeight: 800, textAlign: "end" }}>{fmt2(fair?.fairPS)} {currency}</div>

                  <div style={{ overflowWrap: "anywhere" }}>{t("PE_BASED")}</div>
                  <div style={{ fontWeight: 800, textAlign: "end" }}>{fmt2(fair?.fairPE)} {currency}</div>

                  <div style={{ overflowWrap: "anywhere" }}>{t("EQUITY_PER_SHARE")}</div>
                  <div style={{ fontWeight: 800, textAlign: "end" }}>{fmt2(fair?.equityPerShare)} {currency}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", minWidth: 0 }}>
                <CompareBar current={price ?? 0} fair={fairAvg ?? 0} currency={currency} dir={dir} t={t} />
              </div>
            </div>
          )}
        </Card>

        {/* 3. Revenue & Income */}
        <Card title={`${t("REV_INC_TITLE")} (${currency})`}>
          {(
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
                minWidth: 0,
              }}
            >
              <ChartBlock title={t("REVENUE")} series={serRevenue} w={chartW} dir={dir} t={t} />
              <ChartBlock title={t("OP_INCOME")} series={serOp} w={chartW} dir={dir} t={t} />
              <ChartBlock title={t("NET_INCOME")} series={serNet} w={chartW} dir={dir} t={t} />
            </div>
          )}
        </Card>

        {/* 4. Equity & FCF */}
        <Card title={`${t("EQUITY_FCF_TITLE")} (${currency})`}>
          {(
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(360px, 1fr))",
                gap: 12,
                minWidth: 0,
              }}
            >
              <ChartBlock title={t("TOTAL_EQUITY")} series={serEquity} w={bigChartW} dir={dir} t={t} />
              <ChartBlock title={t("FCF")} series={serFCF} w={bigChartW} dir={dir} t={t} />
            </div>
          )}
        </Card>

        {/* 5. Company profile */}
        <Card title={t("COMPANY_PROFILE")}>
          {!profile ? (
            <div style={{ color: "#475569" }}>{t("NO_DATA")}</div>
          ) : (
            <div style={{ display: "grid", gap: 12, minWidth: 0, width: "100%" }}>
              {(() => {
                const P = lang === "ar" && translatedProfile ? translatedProfile : profile;
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: "6px 16px", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("TICKER")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{profile.symbol ?? ticker}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("INDUSTRY")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.industry || t("NOT_AVAILABLE")}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("SECTOR")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.sector || t("NOT_AVAILABLE")}</span>
                    </div>
                    {(P.description || profile.description) ? (
                      <>
                        <div style={{ fontWeight: 700, color: "#374151" }}>{t("DESCRIPTION")}</div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: "#334155",
                            width: "100%",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                            textAlign: "justify",
                            overflowWrap: "break-word",
                            wordBreak: "break-word",
                          }}
                        >
                          {P.description || profile.description}
                        </p>
                      </>
                    ) : null}
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: "6px 16px", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("CITY")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.city || t("NOT_AVAILABLE")}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("COUNTRY")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.country || t("NOT_AVAILABLE")}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("CEO")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.CEO || t("NOT_AVAILABLE")}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("WEBSITE")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>
                        {profile.website ? (
                          <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>
                            {profile.website}
                          </a>
                        ) : (
                          t("NOT_AVAILABLE")
                        )}
                      </span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("CONTACT")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{profile.phone || t("NOT_AVAILABLE")}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </Card>

        {/* Appendix */}
        <Card title={t("APPENDIX")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : fin.loading && !fin.data ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : fin.error ? (
            <div style={{ color: "#b91c1c" }}>
              {fin.error}
              <RetryButton onRetry={loadFinancials} t={t} />
            </div>
          ) : !years.length ? (
            <div style={{ color: "#475569" }}>{t("NO_DATA")}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ textAlign: "start", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("YEAR")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("REVENUE")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("OP_INCOME")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("NET_INCOME")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("TOTAL_EQUITY")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("FCF")}</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.year}>
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{y.year}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.revenue)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.operatingIncome)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.netIncome)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.totalEquity)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.freeCashFlow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <footer className="no-print" style={{ marginTop: 24, padding: "14px 4px", textAlign: "center", color: "#64748b", fontSize: 12 }}>
        © Trueprice.cash
      </footer>
    </div>
  );
}