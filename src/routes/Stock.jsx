import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { getCompany, getStocks, resolveMarketAndSymbol, fmpSymbolFromResolved } from "../data/stocksCatalog.js";
import { getLivePrice } from "../services/priceService.js";
import { getFinancialsCached } from "../services/financialsService.js";
import { computeValuation } from "../domain/valuation.js";
import { isFmpRetryError } from "../services/fmpErrors.js";
import { fmpProfile } from "../services/fmpService.js";
import { translateToArabic } from "../services/translateService.js";
import { Card } from "../components/Card.jsx";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { RetryButton } from "../components/RetryButton.jsx";
import { CompareBar, ChartBlock } from "../components/stock/StockCharts.jsx";
import { StockNewsSidebar } from "../components/StockNewsSidebar.jsx";
import { StockDcfHero } from "../components/stock/StockDcfHero.jsx";
import { fetchStockDcf } from "../services/dcfService.js";
import { fetchKeyMetrics } from "../services/keyMetricsService.js";
import { fmt2, fmtBill, trendText, calcTrend } from "../domain/formatting.js";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useTrackView } from "../hooks/useActivity.js";
import { StockComments } from "../components/StockComments.jsx";
import { WatchlistManager } from "../components/WatchlistManager.jsx";
import { GoogleGIcon } from "../components/GoogleGIcon.jsx";
import { exportElementAsPdf } from "../utils/exportPdf.js";
import { buildStockSeo } from "../seo/structuredData.js";

/* Page */
export default function Stock() {
  const { ticker } = useParams();
  const { t, lang, dir } = useI18n();
  const { user, login } = useAuth();
  const signInNavigating = useRef(false);
  useTrackView(ticker);
  const [shareCopied, setShareCopied] = useState(false);
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
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportContentRef = React.useRef(null);

  const handleExportPdf = async () => {
    if (!reportContentRef.current || pdfExporting) return;
    setPdfExporting(true);
    try {
      const filename = `${ticker || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      await exportElementAsPdf(reportContentRef.current, filename);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setPdfExporting(false);
    }
  };

  const [company, setCompany] = useState("");
  const [market, setMarket] = useState(null);
  const [currency, setCurrency] = useState("USD");
  const [catalogReady, setCatalogReady] = useState(false);
  const [price, setPrice] = useState(null);
  const [headerError, setHeaderError] = useState("");

  const [fin, setFin] = useState({ loading: false, error: "", data: null });
  const [val, setVal] = useState({ loading: false, error: "", data: null });
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [profile, setProfile] = useState(null);
  const [translatedProfile, setTranslatedProfile] = useState(null);
  const [prefetchCountdown, setPrefetchCountdown] = useState(0);
  const [peers, setPeers] = useState({ loading: false, error: "", list: [] });
  const [peersCountdown, setPeersCountdown] = useState(0);
  const [peersRequested, setPeersRequested] = useState(false);
  const [dcf, setDcf] = useState({ loading: false, error: "", data: null });
  const [keyMetrics, setKeyMetrics] = useState({ loading: false, error: "", data: null });
  const [fmpSymbol, setFmpSymbol] = useState("");

  const reportDate = useMemo(() => new Date().toLocaleDateString(), []);

  // Resolve catalog market first (jp/us/sa) before any FMP calls — avoids wrong-market requests for 7203.T etc.
  useEffect(() => {
    let alive = true;
    setCatalogReady(false);
    setCompany("");
    setMarket(null);
    setPrice(null);
    setHeaderError("");
    (async () => {
      try {
        const cj = await getCompany(ticker);
        if (!alive) return;
        setCompany(cj?.name || "");
        setMarket(cj?.market || "us");
        setCurrency(cj?.currency || "USD");
        setCatalogReady(true);
      } catch (e) {
        if (!alive) return;
        setHeaderError(String(e?.message || e));
        setCatalogReady(false);
      }
    })();
    return () => { alive = false; };
  }, [ticker]);

  // Price: LIVE ONLY (no cache)
  useEffect(() => {
    if (!catalogReady || !market) return;
    let alive = true;
    (async () => {
      try {
        const pj = await getLivePrice({ ticker, market, cache: "no-store" });
        if (!alive) return;
        setPrice(Number(pj?.price));
        if (pj?.currency) setCurrency(pj.currency);
      } catch (e) {
        if (!alive) return;
        const msg = String(e?.message || e);
        setHeaderError(
          msg.toLowerCase().includes("failed to fetch")
            ? t("ERR_PRICE_NETWORK")
            : msg
        );
      }
    })();
    return () => { alive = false; };
  }, [ticker, market, catalogReady]);

  const loadFinancials = useCallback(async () => {
    try {
      setFin({ loading: true, error: "", data: null });
      const j = await getFinancialsCached({ ticker, market });
      setFin({ loading: false, error: "", data: j });
    } catch (e) {
      const error = isFmpRetryError(e) ? t("ERR_STATEMENTS_RETRY") : t("ERR_STATEMENTS");
      setFin({ loading: false, error, data: null });
    }
  }, [ticker, market, t]);

  const loadValuation = useCallback(async () => {
    try {
      setVal({ loading: true, error: "", data: null });
      const j = await computeValuation({ ticker, market, cache: "no-store" });
      setVal({ loading: false, error: "", data: j });
    } catch (e) {
      const error = isFmpRetryError(e) ? t("ERR_VALUATION_RETRY") : t("ERR_VALUATION");
      setVal({ loading: false, error, data: null });
    }
  }, [ticker, market, t]);

  // Load financials and valuation immediately once the catalog is ready
  useEffect(() => {
    if (!catalogReady || !market) return;
    setPrefetchCountdown(0);
    loadFinancials();
    loadValuation();
  }, [ticker, market, catalogReady, loadFinancials, loadValuation]);

  // Logo & profile
  useEffect(() => {
    if (!catalogReady || !market) return;
    let alive = true;
    setLogoLoadError(false);
    (async () => {
      try {
        const r = await resolveMarketAndSymbol(ticker, market);
        if (!r.ok || !alive) return;
        const fmpSym = fmpSymbolFromResolved(r);
        setFmpSymbol(fmpSym || "");
        const profileRes = fmpSym ? await fmpProfile(fmpSym) : null;
        if (!alive) return;
        const logo =
          profileRes?.logoUrl && typeof profileRes.logoUrl === "string" ? profileRes.logoUrl : null;
        setLogoUrl(logo);
        setProfile(profileRes && typeof profileRes === "object" ? profileRes : null);
      } catch {
        if (!alive) return;
        setLogoUrl(null);
        setProfile(null);
        setFmpSymbol("");
      }
    })();

    return () => { alive = false; };
  }, [ticker, market, catalogReady]);

  const loadDcf = useCallback(async () => {
    if (!fmpSymbol) return;
    try {
      setDcf({ loading: true, error: "", data: null });
      const data = await fetchStockDcf(fmpSymbol, market);
      setDcf({ loading: false, error: "", data });
    } catch (e) {
      setDcf({ loading: false, error: String(e?.message || e), data: null });
    }
  }, [fmpSymbol, market]);

  useEffect(() => {
    if (!catalogReady || !fmpSymbol) return;
    loadDcf();
  }, [catalogReady, fmpSymbol, loadDcf, user?.id]);

  const loadKeyMetrics = useCallback(async () => {
    if (!fmpSymbol) return;
    try {
      setKeyMetrics({ loading: true, error: "", data: null });
      const data = await fetchKeyMetrics(fmpSymbol, 5);
      setKeyMetrics({ loading: false, error: "", data: Array.isArray(data) ? data : [] });
    } catch (e) {
      const error = isFmpRetryError(e) ? t("ERR_STATEMENTS_RETRY") : String(e?.message || e);
      setKeyMetrics({ loading: false, error, data: null });
    }
  }, [fmpSymbol, t]);

  useEffect(() => {
    if (!catalogReady || !fmpSymbol) return;
    loadKeyMetrics();
  }, [catalogReady, fmpSymbol, loadKeyMetrics]);

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

  // Industry peers: load only when user clicks button, after 8s countdown
  const loadPeers = useCallback(() => {
    if (!ticker || !market) return;
    let alive = true;
    setPeersRequested(true);
    setPeers((p) => ({ ...p, loading: true, error: "", list: [] }));
    (async () => {
      try {
        const { items } = await getStocks({ market });
        if (!alive) return;
        const tickerNorm =
          market === "us" || market === "jp" ? (ticker || "").toUpperCase() : ticker;
        const sameTicker = (i) =>
          market === "us" || market === "jp"
            ? (i.ticker || "").toUpperCase() === tickerNorm
            : i.ticker === ticker;
        const currentItem = items.find(sameTicker);
        const industry = currentItem?.industry;
        if (!industry) {
          if (alive) setPeers({ loading: false, error: "", list: [] });
          return;
        }
        const peerItems = items
          .filter((i) => i.industry === industry && !sameTicker(i))
          .slice(0, 8);
        const list = [];
        for (const peer of peerItems) {
          if (!alive) break;
          try {
            const v = await computeValuation({ ticker: peer.ticker, market });
            if (!alive) break;
            if (v && Number.isFinite(v.fairEV)) list.push({ ticker: peer.ticker, name: peer.name, fairEV: v.fairEV, price: v?.price ?? null, currency: v.currency });
          } catch {
            // skip failed peer
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        if (alive) setPeers({ loading: false, error: "", list });
      } catch (e) {
        if (alive) setPeers({ loading: false, error: String(e?.message || e), list: [] });
      }
    })();
  }, [ticker, market]);

  useEffect(() => {
    if (peersCountdown <= 0) return;
    const id = setInterval(() => {
      setPeersCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) setTimeout(() => loadPeers(), 0);
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [peersCountdown, loadPeers]);

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

  const investmentAdvice = useMemo(() => {
    const p = Number(price);
    const avg = Number(fairAvg);
    const evVal = Number(fair?.fairEV);
    const hasPrice = Number.isFinite(p) && p > 0;
    const avgGtPrice = hasPrice && Number.isFinite(avg) && avg > p;
    const evGtPrice = hasPrice && Number.isFinite(evVal) && evVal > p;
    const revUp = calcTrend(serRevenue).kind === "up";
    const opUp = calcTrend(serOp).kind === "up";
    const netUp = calcTrend(serNet).kind === "up";
    const fcfUp = calcTrend(serFCF).kind === "up";
    const items = [
      { key: "avg", met: avgGtPrice },
      { key: "ev", met: evGtPrice },
      { key: "rev", met: revUp },
      { key: "op", met: opUp },
      { key: "net", met: netUp },
      { key: "fcf", met: fcfUp },
    ];
    const unmatchCount = items.filter((i) => !i.met).length;
    const verdict = unmatchCount === 0 ? "good" : unmatchCount <= 2 ? "hold" : "avoid";
    return { verdict, items };
  }, [price, fairAvg, fair?.fairEV, serRevenue, serOp, serNet, serFCF]);

  const hasZeroData = useMemo(() => {
    if (prefetchCountdown > 0 || fin.loading || val.loading) return false;
    const zeroPrice = price !== null && price !== undefined && Number(price) === 0;
    const zeroFairValue = val?.data && (fairAvg == null || fairAvg === 0);
    const noFinancials = fin?.data && (years.length === 0 || (
      serRevenue.length === 0 && serOp.length === 0 && serNet.length === 0 &&
      serEquity.length === 0 && serFCF.length === 0
    ));
    return zeroPrice || zeroFairValue || noFinancials;
  }, [prefetchCountdown, fin.loading, val.loading, fin?.data, val?.data, price, fairAvg, years.length, serRevenue.length, serOp.length, serNet.length, serEquity.length, serFCF.length]);

  const chartW = isMobile ? 320 : 380;
  const bigChartW = isMobile ? 320 : 480;

  const companyDisplayName = (lang === "ar" && translatedProfile?.name) || profile?.name || company || "";
  const seo = useMemo(
    () =>
      buildStockSeo({
        ticker,
        companyName: companyDisplayName,
        lang,
        fairValue: fairAvg,
        price,
        currency,
        market,
      }),
    [ticker, companyDisplayName, lang, fairAvg, price, currency, market]
  );
  usePageMeta(seo);

  const analysisSummary = useMemo(() => {
    const name = companyDisplayName || ticker;
    const fairTxt = Number.isFinite(Number(fairAvg)) ? `${fmt2(fairAvg)} ${currency}` : t("NOT_AVAILABLE");
    const priceTxt = Number.isFinite(Number(price)) ? `${fmt2(price)} ${currency}` : t("NOT_AVAILABLE");
    if (lang === "ar") {
      return [
        `تحليل سهم ${name} (${ticker}) على TruePrice.Cash يركز على مقارنة السعر الحالي (${priceTxt}) بالقيمة العادلة التقديرية (${fairTxt}).`,
        "المنهجية تعتمد على البيانات المالية الأساسية مثل الإيرادات والدخل التشغيلي وصافي الدخل والتدفق النقدي الحر لتقديم قراءة عملية للمستثمر.",
        "هذا التقرير تعليمي ولا يُعد توصية شراء أو بيع، ويجب دعمه ببحثك الشخصي وإدارة المخاطر.",
      ];
    }
    return [
      `${name} (${ticker}) stock analysis on TruePrice.Cash compares current market price (${priceTxt}) against estimated fair value (${fairTxt}).`,
      "The framework uses core fundamentals such as revenue, operating income, net income, and free cash flow to provide a practical investor snapshot.",
      "This report is educational only and not financial advice; combine it with your own research and risk management.",
    ];
  }, [companyDisplayName, ticker, fairAvg, price, currency, lang, t]);

  // Key Metrics as a table: metrics are rows, fiscal years are columns (newest → oldest).
  const kmCols = useMemo(
    () => (Array.isArray(keyMetrics.data) ? keyMetrics.data : []),
    [keyMetrics.data]
  );
  const hasKm = kmCols.length > 0;
  const kmCurrency = kmCols[0]?.reportedCurrency || currency;
  const kmTableGroups = useMemo(() => {
    const ar = lang === "ar";
    const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : "—");
    const mult = (v) => (Number.isFinite(v) ? `${fmt2(v)}×` : "—");
    const money = (v) => (Number.isFinite(v) ? `${fmtBill(v)} ${kmCurrency}` : "—");
    return [
      {
        title: ar ? "التقييم" : "Valuation",
        rows: [
          { label: ar ? "قيمة المنشأة" : "Enterprise Value", key: "enterpriseValue", fmt: money },
          { label: ar ? "عائد الأرباح" : "Earnings Yield", key: "earningsYield", fmt: pct },
        ],
      },
      {
        title: ar ? "العوائد" : "Returns",
        rows: [
          { label: ar ? "العائد على حقوق الملكية" : "Return on Equity", key: "returnOnEquity", fmt: pct },
          { label: ar ? "العائد على رأس المال المستثمر" : "Return on Invested Capital", key: "returnOnInvestedCapital", fmt: pct },
        ],
      },
      {
        title: ar ? "السلامة المالية" : "Financial Health",
        rows: [
          { label: ar ? "النسبة الجارية" : "Current Ratio", key: "currentRatio", fmt: mult },
          { label: ar ? "صافي الدين/EBITDA" : "Net Debt / EBITDA", key: "netDebtToEBITDA", fmt: mult },
        ],
      },
    ];
  }, [lang, kmCurrency]);

  const keyMetricsCard = (
    <Card title={lang === "ar" ? "٣. المؤشرات المالية الرئيسية" : "3. Key Metrics"}>
      {!fmpSymbol ? (
        <div style={{ color: "#64748b" }}>{t("LOADING")}</div>
      ) : keyMetrics.loading && !keyMetrics.data ? (
        <div style={{ color: "#64748b" }}>Loading…</div>
      ) : keyMetrics.error ? (
        <div style={{ color: "#b91c1c" }}>
          {keyMetrics.error}
          <RetryButton onRetry={loadKeyMetrics} t={t} />
        </div>
      ) : !hasKm ? (
        <div style={{ color: "#475569" }}>{t("NO_DATA")}</div>
      ) : (
        <div className="tp-km-table-wrap">
          <table className="tp-km-table">
            <thead>
              <tr>
                <th className="tp-km-th-metric">{lang === "ar" ? "المؤشر" : "Metric"}</th>
                {kmCols.map((c, i) => (
                  <th key={c.fiscalYear || c.date || i} className="tp-km-th-year">
                    {c.fiscalYear || c.date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kmTableGroups.map((g) => (
                <React.Fragment key={g.title}>
                  <tr className="tp-km-group-row">
                    <td colSpan={kmCols.length + 1}>{g.title}</td>
                  </tr>
                  {g.rows.map((m) => (
                    <tr className="tp-km-data-row" key={m.label}>
                      <td className="tp-km-metric">{m.label}</td>
                      {kmCols.map((c, i) => (
                        <td
                          key={(c.fiscalYear || c.date || i) + m.key}
                          className="tp-km-cell"
                        >
                          {m.fmt(c[m.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  return (
    <div className="tp-page tp-stock-page" dir={dir} lang={lang}>
      <div
        className="tp-stock-body"
        style={{
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <div ref={reportContentRef} className="tp-stock-report-col tp-stock-content-rail">
        {/* Banner */}
        <div
          className="no-print tp-stock-banner"
          style={{
            alignItems: isMobile ? "stretch" : "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 200px", maxWidth: isMobile ? "100%" : 420 }}>
            {logoUrl && !logoLoadError ? (
              <img
                src={logoUrl}
                alt=""
                referrerPolicy="no-referrer"
                style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, background: "#fff", flexShrink: 0 }}
                onError={() => setLogoLoadError(true)}
              />
            ) : null}
            <div style={{ display: "grid", gap: 2, minWidth: 0, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
                title={(lang === "ar" && translatedProfile?.name) || profile?.name || company || ""}
              >
                {company || (lang === "ar" && translatedProfile?.name) || profile?.name || t("NOT_AVAILABLE")}
                {((lang === "ar" && translatedProfile?.industry) || profile?.industry) ? (
                  <span style={{ fontWeight: 600, opacity: 0.9 }}> – {(lang === "ar" && translatedProfile?.industry) || profile?.industry}</span>
                ) : null}
              </div>
              <div className="tp-stock-banner-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
            <button type="button" className="tp-btn-outline-light" onClick={handleShare}>
              {shareCopied ? t("SHARE_COPIED") : t("SHARE_REPORT")}
            </button>
            <button type="button" className="tp-btn-outline-light" onClick={handlePrint}>
              {t("PRINT_REPORT")}
            </button>
            <button
              type="button"
              className="tp-btn-outline-light"
              onClick={handleExportPdf}
              disabled={pdfExporting}
            >
              {pdfExporting ? "…" : t("EXPORT_PDF")}
            </button>
          </div>
        </div>

        {hasZeroData ? (
          <div
            style={{
              background: "#fef3c7",
              color: "#92400e",
              padding: "12px 16px",
              borderRadius: 12,
              marginBottom: 16,
              fontWeight: 600,
              border: "1px solid #f59e0b",
            }}
          >
            {t("ZERO_DATA_TRY_AGAIN")}
          </div>
        ) : null}

        <StockDcfHero
          t={t}
          dir={dir}
          currency={currency}
          loading={dcf.loading}
          error={dcf.error}
          data={dcf.data}
          livePrice={price}
          user={user}
          onSignIn={login}
          onRetry={loadDcf}
          signInBusy={signInNavigating.current}
        />

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

        <Card title={lang === "ar" ? "ملف السهم" : "Stock Profile"}>
          <div style={{ display: "grid", gap: 10, color: "#334155", lineHeight: 1.75, fontSize: 14 }}>
            {analysisSummary.map((line) => (
              <p key={line} style={{ margin: 0 }}>{line}</p>
            ))}
          </div>
        </Card>

        {/* 3. Key Metrics (FMP key-metrics) */}
        {keyMetricsCard}

        {/* 4. Revenue & Income */}
        <Card title={`${t("REV_INC_TITLE")} (${currency})`}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : (
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

        {/* 5. Equity & FCF */}
        <Card title={`${t("EQUITY_FCF_TITLE")} (${currency})`}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : (
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

        {/* 6. Industry peers (EV-based fair value) – button + 8s wait */}
        <Card title={t("INDUSTRY_PEERS_EV")}>
          {!user ? (
            <div style={{ display: "grid", gap: 12 }}>
              <p style={{ margin: 0, color: "#374151", lineHeight: 1.5 }}>
                Sign in with Google to compare this stock to its industry peers.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (signInNavigating.current) return;
                  signInNavigating.current = true;
                  login();
                }}
                className="tp-signin-google"
                style={{ justifySelf: "start" }}
              >
                <GoogleGIcon size={13} />
                Sign in with Google
              </button>
            </div>
          ) : peersCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("PEERS_WAIT_8S")} {peersCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("PEERS_WAIT_HINT")}</span>
            </div>
          ) : peers.loading ? (
            <div style={{ color: "#64748b" }}>{t("PEERS_LOADING")}</div>
          ) : peers.error ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "#b91c1c" }}>{peers.error}</div>
              <button
                type="button"
                onClick={() => { setPeersCountdown(8); }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 700,
                  cursor: "pointer",
                  alignSelf: "start",
                }}
              >
                {t("PEERS_BUTTON")}
              </button>
            </div>
          ) : !peersRequested && peers.list.length === 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, direction: dir }}>
              <p style={{ margin: 0, color: "#374151", lineHeight: 1.5, flex: "1 1 auto", minWidth: 0 }}>{t("PEERS_PROMPT")}</p>
              <button
                type="button"
                onClick={() => setPeersCountdown(8)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                  marginInlineStart: "auto",
                }}
              >
                {t("PEERS_BUTTON")}
              </button>
            </div>
          ) : peersRequested && !peers.loading && peers.list.length === 0 && !peers.error ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ color: "#475569" }}>{t("PEERS_NO_PEERS")}</div>
              <button
                type="button"
                onClick={() => setPeersCountdown(8)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 700,
                  cursor: "pointer",
                  alignSelf: "start",
                }}
              >
                {t("PEERS_BUTTON")}
              </button>
            </div>
          ) : (
            (() => {
              const currentEV = fair?.fairEV;
              const currentName = (lang === "ar" && translatedProfile?.name) || profile?.name || company || ticker;
              const currentPrice = price != null && Number.isFinite(price) ? price : null;
              const rows = [
                ...(currentEV != null && Number.isFinite(currentEV)
                  ? [{ ticker, name: currentName, fairEV: currentEV, price: currentPrice, currency, isCurrent: true }]
                  : []),
                ...peers.list.map((p) => ({ ...p, isCurrent: false })),
              ].sort((a, b) => (b.fairEV || 0) - (a.fairEV || 0));
              const hasZeroValue = rows.some((r) => r.fairEV === 0 || !Number.isFinite(r.fairEV));
              if (rows.length === 0) return <div style={{ color: "#475569" }}>{t("PEERS_NO_PEERS")}</div>;
              return (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ textAlign: "start", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("TICKER")}</th>
                          <th style={{ textAlign: "start", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("COMPANIES")}</th>
                          <th style={{ textAlign: "end", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("PRICE")}</th>
                          <th style={{ textAlign: "end", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("EV_SHARE")}</th>
                          <th style={{ textAlign: "end", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("PEERS_DIFF_PCT")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const rowPrice = row.price != null && Number.isFinite(row.price) ? row.price : null;
                          const diffPct =
                            rowPrice != null && rowPrice > 0 && row.fairEV != null && Number.isFinite(row.fairEV)
                              ? `${(((row.fairEV - rowPrice) / rowPrice) * 100).toFixed(1)}%`
                              : "—";
                          return (
                            <tr
                              key={row.ticker + (row.isCurrent ? "-current" : "")}
                              style={{
                                background: row.isCurrent ? "#eff6ff" : undefined,
                                borderBottom: "1px solid #f1f5f9",
                              }}
                            >
                              <td style={{ padding: 10, fontWeight: row.isCurrent ? 700 : 400 }}>
                                {row.isCurrent ? t("THIS_STOCK") : (
                                  <Link to={`/stock/${row.ticker}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
                                    {row.ticker}
                                  </Link>
                                )}
                              </td>
                              <td style={{ padding: 10, overflowWrap: "anywhere" }}>{row.name}</td>
                              <td style={{ textAlign: "end", padding: 10 }}>{rowPrice != null ? fmt2(rowPrice) + " " + row.currency : "—"}</td>
                              <td style={{ textAlign: "end", padding: 10, fontWeight: 600 }}>{fmt2(row.fairEV)} {row.currency}</td>
                              <td style={{ textAlign: "end", padding: 10, color: row.isCurrent ? "#64748b" : "#0f172a" }}>{diffPct}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {hasZeroValue ? (
                    <div
                      style={{
                        background: "#fef3c7",
                        color: "#92400e",
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontWeight: 600,
                        border: "1px solid #f59e0b",
                      }}
                    >
                      {t("ZERO_PEER_TRY_AGAIN")}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", direction: dir }}>
                    <button
                      type="button"
                      onClick={() => setPeersCountdown(8)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 13,
                        borderRadius: 8,
                        border: "1px solid #2563eb",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 600,
                        cursor: "pointer",
                        marginInlineStart: "auto",
                      }}
                    >
                      {t("PEERS_BUTTON")}
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </Card>

        {/* 6. Investment summary */}
        <Card title={t("INVESTMENT_SUMMARY")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : (fin.loading && !fin.data) || (val.loading && !val.data) ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#374151" }}>
                {t("INVESTMENT_CONDITIONS_INTRO")}
              </div>
              <ul style={{ margin: 0, paddingInlineStart: 20, display: "grid", gap: 6, color: "#475569", fontSize: 14 }}>
                {investmentAdvice.items.map((item) => (
                  <li key={item.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: item.met ? "#15803d" : "#b91c1c", fontWeight: 700 }}>
                      {item.met ? "✓" : "✗"}
                    </span>
                    <span>
                      {t(`INVESTMENT_CONDITION_${item.key.toUpperCase()}`)}
                    </span>
                  </li>
                ))}
              </ul>
              {(investmentAdvice.verdict === "hold" || investmentAdvice.verdict === "avoid") && (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>
                    {t("INVESTMENT_WAIT_UNTIL")}
                  </div>
                  <ul style={{ margin: 0, paddingInlineStart: 20, display: "grid", gap: 4, color: "#64748b", fontSize: 12 }}>
                    {investmentAdvice.items
                      .filter((i) => !i.met)
                      .map((item) => (
                        <li key={item.key}>
                          • {t(`INVESTMENT_CONDITION_${item.key.toUpperCase()}`)}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color:
                    investmentAdvice.verdict === "good"
                      ? "#15803d"
                      : investmentAdvice.verdict === "hold"
                        ? "#1d4ed8"
                        : "#b91c1c",
                }}
              >
                {investmentAdvice.verdict === "good"
                  ? t("INVESTMENT_GOOD")
                  : investmentAdvice.verdict === "hold"
                    ? t("INVESTMENT_HOLD")
                    : t("INVESTMENT_AVOID")}
              </div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "#ca8a04",
                }}
              >
                {t("INVESTMENT_DISCLAIMER")}
              </div>
            </div>
          )}
        </Card>

        {/* 7. Company profile */}
        <Card title={t("COMPANY_PROFILE")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : !profile ? (
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

        <WatchlistManager ticker={ticker} t={t} />
        <StockComments ticker={ticker} t={t} />

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

        {market === "us" ? (
          <StockNewsSidebar ticker={ticker} market={market} t={t} dir={dir} isMobile={isMobile} />
        ) : null}
      </div>

      <SiteFooter t={t} />
    </div>
  );
}