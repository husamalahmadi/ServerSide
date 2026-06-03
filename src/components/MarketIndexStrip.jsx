import React, { useEffect, useRef, useState } from "react";
import { fetchIndexQuotes } from "../services/indexQuotesService.js";

const INDEX_META = {
  "^SPX": { en: "S&P 500", ar: "إس آند بي 500", short: "S&P 500" },
  "^NDX": { en: "Nasdaq 100", ar: "ناسداك 100", short: "Nasdaq" },
  "^DJI": { en: "Dow Jones", ar: "داو جونز", short: "Dow" },
  "^TASI.SR": { en: "TASI", ar: "تاسي", short: "TASI" },
};

const ORDER = ["^SPX", "^NDX", "^DJI", "^TASI.SR"];
const REFRESH_MS = 15 * 60_000;

function fmtPrice(value) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(value) {
  if (!Number.isFinite(value)) return "";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function MarketIndexStrip({ lang = "en" }) {
  const [quotes, setQuotes] = useState([]);
  const [ready, setReady] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchIndexQuotes();
        if (!alive) return;
        setQuotes(Array.isArray(data) ? data : []);
        setReady(true);
      } catch {
        if (alive) setReady(true);
      }
    };
    load();
    timerRef.current = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const ordered = ORDER.map((sym) => ({ symbol: sym, ...(bySymbol.get(sym) || {}) }));

  return (
    <div className="tp-index-strip" role="list" aria-label="Market indices">
      {ordered.map((q) => {
        const meta = INDEX_META[q.symbol] || { en: q.symbol, ar: q.symbol, short: q.symbol };
        const label = lang === "ar" ? meta.ar : meta.en;
        const hasData = Number.isFinite(q.price);
        const pct = Number(q.changePct);
        const up = Number.isFinite(pct) && pct >= 0;
        const dir = !hasData || !Number.isFinite(pct) ? "flat" : up ? "up" : "down";
        return (
          <div
            key={q.symbol}
            className={`tp-index-chip tp-index-chip--${dir}${ready ? "" : " tp-index-chip--load"}`}
            role="listitem"
            title={meta.en}
          >
            <span className="tp-index-label">{label}</span>
            <span className="tp-index-quote">
              <span className="tp-index-price">{fmtPrice(q.price)}</span>
              {hasData && Number.isFinite(pct) ? (
                <span className="tp-index-pct">
                  <span className="tp-index-caret" aria-hidden>
                    {up ? "▲" : "▼"}
                  </span>
                  {fmtPct(pct)}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
