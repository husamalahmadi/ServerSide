import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getApiUrl } from "../config/env.js";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { SiteFooter } from "../components/SiteFooter.jsx";
import { useI18n } from "../i18n.jsx";
import { stockPath } from "../../shared/seo/stockPaths.js";
import {
  DISCLAIMER,
  EARNINGS_CALENDAR_PATH,
  UNDERVALUED_PATH,
  earningsNoteSeo,
  earningsCalendarSeo,
  compareSeo,
  comparePath,
  sectorPath,
  sectorSeo,
  undervaluedSeo,
  fmtGap,
  fmtNumber,
} from "../../shared/tasiProgrammatic.js";

async function loadJson(path) {
  const res = await fetch(`${getApiUrl()}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "request_failed");
    error.status = res.status;
    throw error;
  }
  return data;
}

function StockName({ row }) {
  return <Link to={stockPath("ar", row.ticker)}>{row.name} ({row.ticker})</Link>;
}

function NumbersTable({ rows, withCompare = false }) {
  return (
    <div className="tp-panel">
      <div className="tp-panel-body" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["الشركة", "السعر", "القيمة العادلة", "الفجوة", ...(withCompare ? ["مقارنة"] : [])].map((label) => (
                <th key={label} style={{ textAlign: "right", padding: "8px 6px" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const peer = rows[(index + 1) % rows.length];
              const canCompare = withCompare && peer && peer.ticker !== row.ticker;
              return (
                <tr key={row.ticker}>
                  <td style={{ padding: "8px 6px" }}><StockName row={row} /></td>
                  <td style={{ padding: "8px 6px" }}>{fmtNumber(row.price)}</td>
                  <td style={{ padding: "8px 6px" }}>{fmtNumber(row.fairValue)}</td>
                  <td style={{ padding: "8px 6px" }}>{fmtGap(row.gapPct)}</td>
                  {withCompare ? (
                    <td style={{ padding: "8px 6px" }}>
                      {canCompare ? <Link to={comparePath(row.ticker, peer.ticker)}>مقابل {peer.ticker}</Link> : "—"}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageFrame({ title, sub, children }) {
  const { t } = useI18n();
  return (
    <div className="tp-page" dir="rtl" lang="ar">
      <header className="tp-page-header">
        <h1 className="tp-page-title">{title}</h1>
        {sub ? <p className="tp-page-sub">{sub}</p> : null}
      </header>
      {children}
      <p className="tp-us-footnote">{DISCLAIMER}</p>
      <p className="tp-us-footnote">
        <Link to={UNDERVALUED_PATH}>أسهم أقل من قيمتها العادلة</Link>
        {" · "}
        <Link to={EARNINGS_CALENDAR_PATH}>نتائج الشركات</Link>
        {" · "}
        <Link to="/sa-markets">أداء تاسي</Link>
      </p>
      <SiteFooter t={t} />
    </div>
  );
}

export default function TasiDataPages() {
  const { sector, pair, ticker, period } = useParams();
  const { pathname } = useLocation();
  const path = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const kind = path.startsWith("/ar/compare/")
    ? "compare"
    : path.startsWith("/ar/sa-markets/")
      ? "sector"
      : path.includes("/نتائج/") && ticker
        ? "note"
        : path.endsWith("نتائج-الشركات")
          ? "earnings"
          : "undervalued";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    const path =
      kind === "compare"
        ? `/api/tasi/compare/${pair}`
        : kind === "sector"
          ? `/api/tasi/sectors/${encodeURIComponent(sector)}`
          : kind === "note"
            ? `/api/tasi/earnings/${encodeURIComponent(ticker)}/${encodeURIComponent(period)}`
            : kind === "earnings"
              ? "/api/tasi/earnings"
              : "/api/tasi/undervalued";
    loadJson(path)
      .then((json) => {
        if (alive) setData(json);
      })
      .catch((err) => {
        if (alive) setError(err?.message || "request_failed");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, pair, sector, ticker, period]);

  const seo =
    kind === "compare" && data?.a && data?.b
      ? compareSeo(data.a, data.b)
      : kind === "sector" && data?.sector
        ? sectorSeo(data.sector, data.slug)
        : kind === "note" && data?.note
          ? earningsNoteSeo(data.note)
          : kind === "earnings"
            ? earningsCalendarSeo()
            : undervaluedSeo();

  usePageMeta({
    title: seo.documentTitle,
    description: seo.metaDescription,
    pathname: seo.pathname,
    alternates: seo.alternates,
    jsonLd: seo.jsonLd,
  });

  const updated = data?.updatedAt ? `آخر تحديث للأرقام: ${String(data.updatedAt).slice(0, 10)}` : "بانتظار أرقام القيمة العادلة من ذاكرة السوق.";

  let body = null;
  if (loading) body = <div className="tp-us-loading">جار التحميل…</div>;
  else if (error) body = <div className="tp-news-status tp-news-status-error">{error === "not_found" ? "هذه الصفحة غير متاحة." : "تعذر تحميل الأرقام. أعد المحاولة."}</div>;
  else if (kind === "undervalued") {
    body = (
      <>
        <p className="tp-page-sub">{updated}</p>
        {data.rows?.length ? <NumbersTable rows={data.rows} /> : <p>لا توجد أسهم بسعر وقيمة عادلة في الذاكرة الآن.</p>}
        <h2 className="tp-page-title" style={{ fontSize: "1.25rem" }}>قطاعات تاسي</h2>
        <p>
          {(data.sectors || []).map((item, index) => (
            <span key={item.slug}>
              {index ? " · " : ""}
              <Link to={item.path}>{item.name}</Link>
            </span>
          ))}
        </p>
      </>
    );
  } else if (kind === "sector") {
    body = (
      <>
        <p className="tp-page-sub">{updated}</p>
        <NumbersTable rows={data.rows || []} withCompare />
      </>
    );
  } else if (kind === "compare") {
    const peers = [data.a, data.b];
    body = (
      <>
        <p className="tp-page-sub">
          نفس القطاع: <Link to={data.sectorPath}>{data.sector}</Link>
          {" · "}
          {updated}
        </p>
        <NumbersTable rows={peers} />
      </>
    );
  } else if (kind === "earnings") {
    body = (
      <div className="tp-panel">
        <div className="tp-panel-body" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["الشركة", "القطاع", "آخر تعليق"].map((label) => (
                  <th key={label} style={{ textAlign: "right", padding: "8px 6px" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.rows || []).map((row) => (
                <tr key={row.ticker}>
                  <td style={{ padding: "8px 6px" }}><StockName row={row} /></td>
                  <td style={{ padding: "8px 6px" }}><Link to={sectorPath(row.sectorSlug)}>{row.sector}</Link></td>
                  <td style={{ padding: "8px 6px" }}>
                    {row.note ? <Link to={row.note.path}>{row.note.period}</Link> : "بانتظار النتائج"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } else if (kind === "note") {
    body = (
      <>
        {(data.lines || []).map((line) => <p key={line}>{line}</p>)}
        <p>
          <Link to={stockPath("ar", data.note.ticker)}>صفحة السهم</Link>
          {data.note.sectorSlug ? (
            <>
              {" · "}
              <Link to={sectorPath(data.note.sectorSlug)}>{data.note.sector}</Link>
            </>
          ) : null}
        </p>
      </>
    );
  }

  const title =
    kind === "compare" && data?.a
      ? `${data.a.name} مقابل ${data.b.name}`
      : kind === "sector" && data?.sector
        ? data.sector
        : kind === "note" && data?.note
          ? `نتائج ${data.note.name}`
          : kind === "earnings"
            ? "نتائج شركات تاسي"
            : "أسهم تاسي أقل من قيمتها العادلة";

  return (
    <PageFrame title={title} sub={kind === "undervalued" ? "أسهم تاسي التي يزيد تقدير قيمتها العادلة على سعر السوق." : ""}>
      {body}
    </PageFrame>
  );
}
