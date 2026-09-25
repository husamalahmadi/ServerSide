import React, { useMemo, useState } from "react";

const CITATIONS = [
  {
    authors: "Lakonishok & Lee (2001)",
    title: "Are Insider Trades Informative?",
    venue: "Review of Financial Studies",
    href: "https://doi.org/10.1093/rfs/14.1.79",
  },
  {
    authors: "Cohen, Malloy & Pomorski (2012)",
    title: "Decoding Inside Information",
    venue: "Journal of Finance",
    href: "https://doi.org/10.1111/j.1540-6261.2012.01740.x",
  },
  {
    authors: "Gao, Ma, Ng & Wu (2022)",
    title: "The Sound of Silence",
    venue: "Management Science",
    href: "https://doi.org/10.1287/mnsc.2021.4113",
  },
  {
    authors: "Yermack (1997)",
    title: "Good Timing: CEO Stock Option Awards and Company News Announcements",
    venue: "Journal of Finance",
    href: "https://doi.org/10.1111/j.1540-6261.1997.tb04809.x",
  },
];

function money(n) {
  const v = Number(n) || 0;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

function shares(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

function priceFmt(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : `$${v.toFixed(2)}`;
}

function stakePct(trade) {
  const sh = trade.securitiesTransacted || 0;
  const before = (trade.securitiesOwned || 0) - sh;
  if (before > 0) return (sh / before) * 100;
  return sh > 0 ? 100 : 0;
}

function verdictTone(verdict) {
  if (verdict?.startsWith("Strong")) return "strong";
  if (verdict?.startsWith("Moderate")) return "moderate";
  if (verdict?.startsWith("Weak")) return "weak";
  return "none";
}

function ScoreRing({ score }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg className="tp-ifp-ring" viewBox="0 0 140 140" aria-hidden>
      <circle cx="70" cy="70" r={r} className="tp-ifp-ring-track" />
      <circle
        cx="70"
        cy="70"
        r={r}
        className="tp-ifp-ring-value"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="66" textAnchor="middle" className="tp-ifp-ring-num">
        {score}
      </text>
      <text x="70" y="86" textAnchor="middle" className="tp-ifp-ring-cap">
        / 100
      </text>
    </svg>
  );
}

function FootprintChart({ prices, buys, sells }) {
  const model = useMemo(() => {
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const series = prices.filter((p) => p.date >= cutoff);
    if (series.length < 2) return null;
    const w = 720;
    const h = 280;
    const pad = { l: 48, r: 16, t: 18, b: 28 };
    const min = Math.min(...series.map((p) => p.price));
    const max = Math.max(...series.map((p) => p.price));
    const span = max - min || 1;
    const xOf = (date) => {
      const i = series.findIndex((p) => p.date >= date);
      const idx = i < 0 ? series.length - 1 : i;
      return pad.l + (idx / (series.length - 1)) * (w - pad.l - pad.r);
    };
    const yOf = (price) => pad.t + (1 - (price - min) / span) * (h - pad.t - pad.b);
    const line = series.map((p, i) => `${i ? "L" : "M"} ${xOf(p.date).toFixed(1)} ${yOf(p.price).toFixed(1)}`).join(" ");
    const area = `${line} L ${xOf(series.at(-1).date).toFixed(1)} ${h - pad.b} L ${xOf(series[0].date).toFixed(1)} ${h - pad.b} Z`;
    const buyMarks = buys
      .filter((b) => b.transactionDate >= cutoff && b.price > 0)
      .map((b) => ({ x: xOf(b.transactionDate), y: yOf(b.price), name: b.reportingName, date: b.transactionDate }));
    const saleDays = new Map();
    for (const s of sells) {
      if (s.transactionDate < cutoff) continue;
      const usd = (s.securitiesTransacted || 0) * (s.price || 0);
      if (usd <= 0) continue;
      const prev = saleDays.get(s.transactionDate) || { usd: 0, price: s.price };
      prev.usd += usd;
      prev.price = s.price || prev.price;
      saleDays.set(s.transactionDate, prev);
    }
    const saleList = [...saleDays.entries()].map(([date, v]) => ({ date, ...v }));
    const maxUsd = Math.max(...saleList.map((s) => s.usd), 1);
    const saleMarks = saleList.map((s) => ({
      x: xOf(s.date),
      y: yOf(s.price),
      r: 4 + 14 * Math.sqrt(s.usd / maxUsd),
      usd: s.usd,
      date: s.date,
    }));
    const ticks = [min, (min + max) / 2, max];
    return { w, h, pad, line, area, buyMarks, saleMarks, ticks, yOf, series };
  }, [prices, buys, sells]);

  if (!model) {
    return <p className="tp-ifp-empty">Not enough price history to draw the last 12 months.</p>;
  }

  return (
    <svg className="tp-ifp-chart" viewBox={`0 0 ${model.w} ${model.h}`} role="img" aria-label="Twelve month price with insider buys and sales">
      {model.ticks.map((tick) => (
        <g key={tick}>
          <line x1={model.pad.l} x2={model.w - model.pad.r} y1={model.yOf(tick)} y2={model.yOf(tick)} className="tp-ifp-grid" />
          <text x={model.pad.l - 8} y={model.yOf(tick) + 4} textAnchor="end" className="tp-ifp-axis">
            {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick.toFixed(0)}
          </text>
        </g>
      ))}
      <text x={model.pad.l} y={model.h - 8} className="tp-ifp-axis">{model.series[0].date}</text>
      <text x={model.w - model.pad.r} y={model.h - 8} textAnchor="end" className="tp-ifp-axis">{model.series.at(-1).date}</text>
      <path d={model.area} className="tp-ifp-area" />
      <path d={model.line} className="tp-ifp-line" />
      {model.saleMarks.map((s) => (
        <circle key={s.date} cx={s.x} cy={s.y} r={s.r} className="tp-ifp-sale">
          <title>{`${s.date}: sales ${money(s.usd)}`}</title>
        </circle>
      ))}
      {model.buyMarks.map((b, i) => (
        <path
          key={`${b.date}-${i}`}
          d={`M ${b.x} ${b.y - 7} L ${b.x + 6} ${b.y + 5} L ${b.x - 6} ${b.y + 5} Z`}
          className="tp-ifp-buy"
        >
          <title>{`${b.date}: ${b.name} bought`}</title>
        </path>
      ))}
    </svg>
  );
}

function TradesTable({ rows, routineKeys, mode }) {
  if (!rows.length) return <p className="tp-ifp-empty">No {mode} in the window we pulled.</p>;
  const routine = new Set(routineKeys || []);
  return (
    <div className="tp-ifp-table-wrap">
      <table className="tp-ifp-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Insider</th>
            <th>Role</th>
            <th>Shares</th>
            <th>Price</th>
            <th>Value</th>
            <th>Stake change</th>
            {mode === "buys" ? <th>Pattern</th> : null}
            <th>Filing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = [row.reportingCik, row.transactionDate, row.transactionType, row.securitiesTransacted, row.price, row.securitiesOwned].join("|");
            return (
              <tr key={key}>
                <td>{row.transactionDate}</td>
                <td>{row.reportingName}</td>
                <td>{row.typeOfOwner || "—"}</td>
                <td>{shares(row.securitiesTransacted)}</td>
                <td>{priceFmt(row.price)}</td>
                <td>{row.price > 0 ? money(row.securitiesTransacted * row.price) : "—"}</td>
                <td>{stakePct(row).toFixed(0)}%</td>
                {mode === "buys" ? <td>{routine.has(key) ? "Routine" : "Opportunistic"}</td> : null}
                <td>
                  {row.url ? (
                    <a href={row.url} target="_blank" rel="noreferrer">SEC</a>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function InsiderFootprintPanel({ data }) {
  const [tab, setTab] = useState("buys");
  if (!data || data.status !== "ok") return null;
  const tone = verdictTone(data.verdict);
  const quarters = [...(data.quarters || [])]
    .sort((a, b) => b.year - a.year || b.quarter - a.quarter)
    .slice(0, 8);
  const trades = data.trades || { buys: [], sells: [], awards: [] };
  const active = tab === "sells" ? trades.sells : tab === "awards" ? trades.awards : trades.buys;

  return (
    <div className="tp-ifp" data-tone={tone}>
      <section className="tp-ifp-hero">
        <ScoreRing score={data.score} />
        <div className="tp-ifp-hero-copy">
          <div className="tp-ifp-kicker">{data.symbol} · open-market Form 4</div>
          <h2 className="tp-ifp-verdict">
            <span className={`tp-ifp-pill tp-ifp-pill-${tone}`}>{data.verdict}</span>
          </h2>
          <p className="tp-ifp-summary">{data.summary}</p>
          {data.flags?.length ? (
            <ul className="tp-ifp-flags">
              {data.flags.map((flag) => (
                <li key={flag.id} className="tp-ifp-flag" title={flag.detail}>
                  {flag.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="tp-ifp-card">
        <header className="tp-ifp-card-head">
          <h3>Five tests</h3>
          <p>Flags are information only. They never change the score.</p>
        </header>
        <ol className="tp-ifp-checks">
          {(data.checks || []).map((check) => (
            <li key={check.id} data-status={check.status}>
              <div className="tp-ifp-check-top">
                <strong>{check.name}</strong>
                <span>{check.points}/{check.max}</span>
              </div>
              <div className="tp-ifp-meter" aria-hidden>
                <span style={{ width: `${(check.points / check.max) * 100}%` }} />
              </div>
              <p>{check.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="tp-ifp-card">
        <header className="tp-ifp-card-head">
          <h3>12-month price</h3>
          <p className="tp-ifp-legend">
            <span className="tp-ifp-key tp-ifp-key-buy">Buys</span>
            <span className="tp-ifp-key tp-ifp-key-sale">Sales, sized by dollar value</span>
          </p>
        </header>
        <FootprintChart prices={data.prices || []} buys={trades.buys || []} sells={trades.sells || []} />
      </section>

      <section className="tp-ifp-card">
        <header className="tp-ifp-card-head">
          <h3>Last 8 quarters</h3>
        </header>
        <div className="tp-ifp-table-wrap">
          <table className="tp-ifp-table">
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Purchases</th>
                <th>Sales</th>
                <th>NPR</th>
                <th>Acquired</th>
                <th>Disposed</th>
              </tr>
            </thead>
            <tbody>
              {quarters.map((q) => {
                const npr = q.totalPurchases + q.totalSales > 0
                  ? (q.totalPurchases - q.totalSales) / (q.totalPurchases + q.totalSales)
                  : null;
                return (
                  <tr key={`${q.year}-${q.quarter}`}>
                    <td>{q.year} Q{q.quarter}</td>
                    <td>{shares(q.totalPurchases)}</td>
                    <td>{shares(q.totalSales)}</td>
                    <td>{npr == null ? "—" : npr.toFixed(2)}</td>
                    <td>{shares(q.totalAcquired)}</td>
                    <td>{shares(q.totalDisposed)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tp-ifp-caption">
          Purchases and sales are open-market only. Acquired/Disposed include grants, option exercises and tax withholding.
        </p>
      </section>

      <section className="tp-ifp-card">
        <div className="tp-ifp-tabs" role="tablist">
          {[
            ["buys", "Buys"],
            ["sells", "Sales"],
            ["awards", "Awards"],
          ].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
              {label}
              <span>{(trades[id] || []).length}</span>
            </button>
          ))}
        </div>
        <TradesTable rows={active || []} routineKeys={data.routineBuyKeys} mode={tab} />
      </section>

      <details className="tp-ifp-how">
        <summary>How this score works</summary>
        <div className="tp-ifp-how-body">
          <ol>
            <li><strong>Cluster buying (30).</strong> Distinct insiders who bought on the open market in the last 90 days. Three or more is the full mark.</li>
            <li><strong>Opportunistic, not routine (15).</strong> A buy is routine when that insider bought in the same calendar month in at least two earlier years.</li>
            <li><strong>Conviction size (15).</strong> How much the largest buy added to that insider’s holding, with a bump when the dollar total is large.</li>
            <li><strong>Buying into weakness (15).</strong> Average distance below the trailing 52-week high on the buy dates.</li>
            <li><strong>Net purchase ratio (25).</strong> Open-market purchases versus sales over the last two quarters. Purchases and sales here are transaction counts, not share totals.</li>
          </ol>
          <p>A selling-pace flag appears when this quarter’s open-market sales are at least double the recent average. A mega-grant flag appears when one insider’s recent awards are at least five times the typical quarterly amount acquired. Neither flag changes the score.</p>
          <ul className="tp-ifp-cites">
            {CITATIONS.map((cite) => (
              <li key={cite.href}>
                <a href={cite.href} target="_blank" rel="noreferrer">{cite.authors}, <em>{cite.title}</em>, {cite.venue}</a>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <p className="tp-ifp-disclaimer">
        Research tool, not financial advice. Insider buying has historically added a few percentage points of excess return on average, mostly in small and mid caps. It does not forecast price booms.
      </p>
    </div>
  );
}
