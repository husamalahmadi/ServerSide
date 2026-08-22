import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CURRENCY_BY_MARKET, getAllStocks } from "../../data/stocksCatalog.js";
import { getLivePrice } from "../../services/priceService.js";
import { fairValueMove, fairValueVerdict } from "../../../shared/fairValueVerdict.js";
import { fmt2 } from "../../domain/formatting.js";

const MARKET_ORDER = ["us", "sa", "jp", "uk", "other"];
const QUOTE_CONCURRENCY = 5;

function normTicker(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function itemTicker(item) {
  return typeof item === "string" ? item : item?.ticker;
}

function marketLabel(market, t) {
  if (market === "us") return t("WATCHLIST_BADGE_US");
  if (market === "sa") return t("WATCHLIST_BADGE_SA");
  if (market === "jp") return t("WATCHLIST_BADGE_JP");
  if (market === "uk") return t("WATCHLIST_BADGE_UK");
  return t("MARKET");
}

function marketTitle(market, t) {
  if (market === "us") return t("MARKET_US");
  if (market === "sa") return t("MARKET_SA");
  if (market === "jp") return t("MARKET_JP");
  if (market === "uk") return t("MARKET_UK");
  return t("MARKET");
}

function fmtMoney(n, currency) {
  if (!Number.isFinite(n)) return "—";
  const amount = fmt2(n);
  if (currency === "USD") return `$${amount}`;
  if (currency) return `${amount} ${currency}`;
  return amount;
}

function fmtSignedPct(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function discountPct(price, fairValue) {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(fairValue) || fairValue <= 0) {
    return null;
  }
  return ((fairValue - price) / price) * 100;
}

function changeBadge(item, t) {
  const reason = item?.fv_change_reason || null;
  if (!reason) return null;
  const move = fairValueMove(item?.fair_value_at_add, item?.last_known_fv);
  const movePct = move == null ? null : Math.round(Math.abs(move) * 100);
  if (reason === "now_undervalued") return { tone: "under", label: t("WATCHLIST_FV_NOW_UNDERVALUED") };
  if (reason === "now_overvalued") return { tone: "over", label: t("WATCHLIST_FV_NOW_OVERVALUED") };
  if (reason === "move" && movePct != null) {
    return { tone: "move", label: t("WATCHLIST_FV_MOVED").replace("{pct}", String(movePct)) };
  }
  return null;
}

function railPercents(price, fairValue) {
  const max = Math.max(price, fairValue, 0);
  if (!(max > 0) || !Number.isFinite(price) || !Number.isFinite(fairValue)) return null;
  return {
    price: Math.min(100, (price / max) * 100),
    fv: Math.min(100, (fairValue / max) * 100),
    low: Math.min(price, fairValue) / max * 100,
    span: Math.abs(price - fairValue) / max * 100,
  };
}

async function fetchQuotes(tickers) {
  const unique = [...new Set(tickers.map(normTicker).filter(Boolean))];
  const out = {};
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const ticker = unique[cursor];
      cursor += 1;
      try {
        out[ticker] = await getLivePrice({ ticker });
      } catch {
        out[ticker] = null;
      }
    }
  }

  const n = Math.min(QUOTE_CONCURRENCY, unique.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function WatchlistRow({ row, t }) {
  const { ticker, name, industry, market, currency, price, fairValue, quoteLoading } = row;
  const disc = discountPct(price, fairValue);
  const verdict = fairValueVerdict(price, fairValue);
  const flagged = changeBadge(row, t);
  const rail = railPercents(price, fairValue);
  const upside = Number.isFinite(disc) && disc > 0;
  const marketKey = MARKET_ORDER.includes(market) ? market : "other";

  return (
    <Link to={`/stock/${encodeURIComponent(ticker)}`} className={`tp-wl-row ${marketKey}`}>
      <div className="tp-wl-row-identity">
        <span className="tp-wl-ticker">{ticker}</span>
        <span className="tp-wl-name" title={name || ticker}>
          {name || ticker}
        </span>
        {industry ? <span className="tp-wl-industry">{industry}</span> : null}
        <span className={`tp-scr-market-badge ${marketKey === "other" ? "" : marketKey}`.trim()}>
          {marketLabel(market, t)}
        </span>
      </div>

      <div className="tp-wl-metrics">
        <div className="tp-wl-metric">
          <span className="tp-wl-metric-label">{t("PRICE")}</span>
          <span className="tp-wl-metric-value">
            {quoteLoading ? <span className="tp-wl-skel-line" /> : fmtMoney(price, currency)}
          </span>
        </div>
        <div className="tp-wl-metric">
          <span className="tp-wl-metric-label">{t("WATCHLIST_FV_LABEL")}</span>
          <span className="tp-wl-metric-value">{fmtMoney(fairValue, currency)}</span>
        </div>
        <div className="tp-wl-metric tp-wl-metric--delta">
          <span className="tp-wl-metric-label">
            {upside ? t("WATCHLIST_UPSIDE") : t("WATCHLIST_VS_FV")}
          </span>
          <span
            className={`tp-wl-metric-value ${
              disc == null ? "" : disc >= 0 ? "tp-us-pos" : "tp-us-neg"
            }`}
          >
            {fmtSignedPct(disc)}
          </span>
        </div>
      </div>

      {rail ? (
        <div className="tp-wl-rail" aria-hidden="true">
          <div className="tp-wl-rail-track">
            <span
              className={`tp-wl-rail-span ${disc >= 0 ? "is-under" : "is-over"}`}
              style={{ insetInlineStart: `${rail.low}%`, width: `${rail.span}%` }}
            />
            <span
              className="tp-wl-rail-dot tp-wl-rail-dot--price"
              style={{ insetInlineStart: `${rail.price}%` }}
              title={t("PRICE")}
            />
            <span
              className="tp-wl-rail-dot tp-wl-rail-dot--fv"
              style={{ insetInlineStart: `${rail.fv}%` }}
              title={t("WATCHLIST_FV_LABEL")}
            />
          </div>
        </div>
      ) : null}

      <div className="tp-wl-row-flags">
        {verdict && !flagged ? (
          <span className={`tp-wl-flag ${verdict === "undervalued" ? "is-under" : "is-over"}`}>
            {verdict === "undervalued" ? t("WATCHLIST_UNDERVALUED") : t("WATCHLIST_OVERVALUED")}
          </span>
        ) : null}
        {flagged ? <span className={`tp-wl-flag is-${flagged.tone}`}>{flagged.label}</span> : null}
      </div>
    </Link>
  );
}

function WatchlistBoard({ list, catalogByTicker, quotes, quotesLoading, t }) {
  const rows = useMemo(() => {
    return (list.items || []).map((raw) => {
      const item = typeof raw === "string" ? { ticker: raw } : raw || {};
      const ticker = itemTicker(item);
      const key = normTicker(ticker);
      const catalog = catalogByTicker.get(key);
      const quote = quotes[key];
      const market = item.market || catalog?.market || "other";
      const currency =
        item.currency || quote?.currency || CURRENCY_BY_MARKET[market] || catalog?.currency || null;
      const fv = Number(item.last_known_fv);
      const price = Number(quote?.price);
      return {
        ...item,
        ticker,
        name: item.name || catalog?.name || null,
        industry: item.industry || catalog?.industry || null,
        market,
        currency,
        fairValue: Number.isFinite(fv) && fv > 0 ? fv : null,
        price: Number.isFinite(price) && price > 0 ? price : null,
        quoteLoading: quotesLoading && quote === undefined,
      };
    });
  }, [list.items, catalogByTicker, quotes, quotesLoading]);

  const groups = useMemo(() => {
    const buckets = new Map();
    for (const row of rows) {
      const key = MARKET_ORDER.includes(row.market) ? row.market : "other";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(row);
    }
    return MARKET_ORDER.filter((m) => buckets.has(m)).map((market) => ({
      market,
      rows: buckets.get(market),
    }));
  }, [rows]);

  const underCount = rows.filter((r) => fairValueVerdict(r.price, r.fairValue) === "undervalued").length;
  const overCount = rows.filter((r) => fairValueVerdict(r.price, r.fairValue) === "overvalued").length;

  return (
    <article className="tp-wl-board">
      <header className="tp-wl-board-head">
        <div>
          <h3 className="tp-wl-board-title">{list.name}</h3>
          <p className="tp-wl-board-sub">
            {t("WATCHLIST_STOCKS_COUNT").replace("{n}", String(rows.length))}
          </p>
        </div>
        <div className="tp-wl-board-chips">
          {underCount > 0 ? (
            <span className="tp-wl-chip is-under">
              {underCount} {t("WATCHLIST_UNDERVALUED")}
            </span>
          ) : null}
          {overCount > 0 ? (
            <span className="tp-wl-chip is-over">
              {overCount} {t("WATCHLIST_OVERVALUED")}
            </span>
          ) : null}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="tp-wl-empty">{t("WATCHLIST_EMPTY_LIST")}</p>
      ) : (
        groups.map((group) => (
          <section key={group.market} className="tp-wl-market">
            <header className={`tp-wl-market-head ${group.market}`}>
              <span className="tp-wl-market-title">{marketTitle(group.market, t)}</span>
              <span className="tp-wl-market-count">{group.rows.length}</span>
            </header>
            <div className="tp-wl-rows">
              {group.rows.map((row) => (
                <WatchlistRow key={row.ticker} row={row} t={t} />
              ))}
            </div>
          </section>
        ))
      )}
    </article>
  );
}

export function ProfileWatchlists({ watchlists, t }) {
  const lists = watchlists || [];
  const [catalogByTicker, setCatalogByTicker] = useState(() => new Map());
  const [quotes, setQuotes] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  const tickerKey = useMemo(() => {
    const all = [];
    for (const list of lists) {
      for (const item of list.items || []) {
        const ticker = itemTicker(item);
        if (ticker) all.push(normTicker(ticker));
      }
    }
    return [...new Set(all)].sort().join("|");
  }, [lists]);

  const tickers = useMemo(() => (tickerKey ? tickerKey.split("|") : []), [tickerKey]);

  useEffect(() => {
    let alive = true;
    getAllStocks()
      .then(({ items }) => {
        if (!alive) return;
        const map = new Map();
        for (const it of items || []) {
          map.set(normTicker(it.ticker), it);
        }
        setCatalogByTicker(map);
      })
      .catch(() => {
        if (alive) setCatalogByTicker(new Map());
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!tickers.length) {
      setQuotes({});
      setQuotesLoading(false);
      return;
    }
    let alive = true;
    setQuotesLoading(true);
    fetchQuotes(tickers)
      .then((next) => {
        if (alive) setQuotes(next);
      })
      .finally(() => {
        if (alive) setQuotesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tickers]);

  if (!lists.length) {
    return (
      <div className="tp-wl-empty-state">
        <div className="tp-wl-empty-title">{t("PROFILE_NO_PUBLIC_WATCHLISTS")}</div>
        <p className="tp-wl-empty-hint">{t("WATCHLIST_EMPTY_HINT")}</p>
      </div>
    );
  }

  return (
    <div className="tp-wl">
      {lists.map((list) => (
        <WatchlistBoard
          key={list.id}
          list={list}
          catalogByTicker={catalogByTicker}
          quotes={quotes}
          quotesLoading={quotesLoading}
          t={t}
        />
      ))}
    </div>
  );
}
