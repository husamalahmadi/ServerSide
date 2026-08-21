/**
 * Watchlist fair-value snapshots and the daily recompute sweep.
 *
 * Fair value comes from buildYearlyEvFairValue (same builder as the stock page chart),
 * financials come from the shared per-ticker disk cache the screener build fills, and
 * prices come from the batch-quote helper — so this adds no new FMP access pattern.
 */
import { buildYearlyEvFairValue } from "../shared/evFairValue.js";
import { detectFairValueChange } from "../shared/fairValueVerdict.js";
import { fetchFmpFinancialsBundle } from "./fmpFetch.js";
import { fetchAllBatchQuotes, num } from "./fmpBatchQuotes.js";
import { fmpSymbolFor } from "./buildScreenerFromFmp.js";
import { findStockByTicker, CURRENCY_BY_MARKET } from "./stockCatalogLookup.js";

const FV_COLUMNS = [
  ["fair_value_at_add", "REAL"],
  ["last_known_fv", "REAL"],
  ["last_notified_fv", "REAL"],
  ["fv_updated_at", "TEXT"],
  ["fv_change_reason", "TEXT"],
];

/** Columns the watchlist read routes expose alongside the ticker. */
export const WATCHLIST_ITEM_FV_COLUMNS =
  "fair_value_at_add, last_known_fv, fv_updated_at, fv_change_reason";

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Let the boot settle (catalog warm, screener check) before hitting FMP. */
const SWEEP_BOOT_DELAY_MS = 60 * 1000;
const SWEEP_STALE_MS = 20 * 60 * 60 * 1000;

let sweepPromise = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Add fair-value columns to an existing watchlist_items table (never drops data). */
export function migrateWatchlistFairValueColumns(db) {
  const existing = new Set(
    db.prepare("PRAGMA table_info(watchlist_items)").all().map((c) => c.name)
  );
  for (const [name, type] of FV_COLUMNS) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE watchlist_items ADD COLUMN ${name} ${type}`);
    console.log(`[watchlist/fv] migration: added watchlist_items.${name}`);
  }
}

/**
 * Stored ticker → catalog entry with its FMP symbol.
 * @returns {{ ticker: string, market: string, fmpSymbol: string, currency: string }|null}
 */
export function resolveWatchlistTicker(ticker) {
  const raw = String(ticker || "").trim();
  if (!raw) return null;
  let found = null;
  try {
    found = findStockByTicker(raw);
  } catch (err) {
    console.warn(`[watchlist/fv] catalog lookup failed for ${raw}: ${err.message}`);
    return null;
  }
  if (!found) return null;
  return {
    ticker: raw.toUpperCase(),
    market: found.market,
    fmpSymbol: fmpSymbolFor(found.market, found.hit.ticker),
    currency: CURRENCY_BY_MARKET[found.market] || "USD",
  };
}

/** Currency for a watchlist row, without resolving the whole catalog entry. */
export function watchlistItemCurrency(ticker) {
  return resolveWatchlistTicker(ticker)?.currency || null;
}

/** Most recent year of the EV fair-value series for a financials bundle. */
function latestFairValueFromBundle(bundle) {
  const series = buildYearlyEvFairValue({
    balanceSheet: bundle?.balance || [],
    enterpriseValues: bundle?.enterpriseValues || [],
    incomeStatement: bundle?.income || [],
  });
  return series.length ? series[series.length - 1].fairValue : null;
}

function bundleFromStore(financialsStore, symbol) {
  if (!financialsStore) return null;
  const hit = financialsStore.readRecord(symbol);
  if (!hit?.record || financialsStore.isExpired(hit.record)) return null;
  return {
    symbol,
    companyName: hit.record.companyName,
    income: hit.record.income,
    balance: hit.record.balance,
    cash: hit.record.cash,
    enterpriseValues: hit.record.enterpriseValues,
    fetchErrors: [],
  };
}

/** Fair value from cached financials only — no network, safe on a request path. */
export function fairValueFromCache(financialsStore, fmpSymbol) {
  const bundle = bundleFromStore(financialsStore, fmpSymbol);
  return bundle ? latestFairValueFromBundle(bundle) : null;
}

/** Cache first, then FMP; a fetched bundle is written back to the shared cache. */
export async function fetchFairValueForSymbol({ fmpSymbol, companyName, apiKey, financialsStore }) {
  const cached = fairValueFromCache(financialsStore, fmpSymbol);
  if (cached != null) return { fairValue: cached, fetched: false };
  if (!apiKey) return { fairValue: null, fetched: false };

  const bundle = await fetchFmpFinancialsBundle(fmpSymbol, apiKey);
  if (bundle.fetchErrors?.length) return { fairValue: null, fetched: true };
  if (financialsStore) {
    financialsStore.writeRecord(fmpSymbol, bundle.companyName || companyName || null, bundle);
  }
  return { fairValue: latestFairValueFromBundle(bundle), fetched: true };
}

function writeSnapshot(db, watchlistId, ticker, fairValue) {
  db.prepare(
    `UPDATE watchlist_items
     SET fair_value_at_add=?, last_known_fv=?, fv_updated_at=?
     WHERE watchlist_id=? AND ticker=?`
  ).run(fairValue, fairValue, new Date().toISOString(), watchlistId, ticker);
}

/**
 * Snapshot fair value for a row that was just added. Cached financials are written
 * before this returns; a cache miss is filled by the returned background promise so
 * the add request never waits on FMP and never fails because of it.
 */
export function snapshotFairValueOnAdd({ db, watchlistId, ticker, apiKey, financialsStore }) {
  try {
    const resolved = resolveWatchlistTicker(ticker);
    if (!resolved) return { snapshot: null, pending: null };

    const cached = fairValueFromCache(financialsStore, resolved.fmpSymbol);
    if (cached != null) {
      writeSnapshot(db, watchlistId, resolved.ticker, cached);
      return { snapshot: cached, pending: null };
    }

    const pending = fetchFairValueForSymbol({
      fmpSymbol: resolved.fmpSymbol,
      apiKey,
      financialsStore,
    })
      .then(({ fairValue }) => {
        if (fairValue != null) writeSnapshot(db, watchlistId, resolved.ticker, fairValue);
      })
      .catch((err) => {
        console.warn(`[watchlist/fv] snapshot ${resolved.ticker} failed: ${err.message}`);
      });

    return { snapshot: null, pending };
  } catch (err) {
    console.warn(`[watchlist/fv] snapshot ${ticker} skipped: ${err.message}`);
    return { snapshot: null, pending: null };
  }
}

/** One batch-quote pass for every watchlisted symbol, keyed by stored ticker. */
async function pricesByTicker(entries, apiKey, delayMs) {
  const byTicker = new Map();
  if (!apiKey || !entries.length) return byTicker;
  try {
    const quotes = await fetchAllBatchQuotes(
      entries.map((e) => e.fmpSymbol),
      apiKey,
      { delayMs }
    );
    const bySymbol = new Map();
    for (const q of quotes) {
      const symbol = String(q?.symbol || "").toUpperCase();
      const price = num(q?.price);
      if (symbol && price != null && price > 0) bySymbol.set(symbol, price);
    }
    for (const entry of entries) {
      const price = bySymbol.get(entry.fmpSymbol.toUpperCase());
      if (price != null) byTicker.set(entry.ticker, price);
    }
  } catch (err) {
    console.warn(`[watchlist/fv] batch quotes failed: ${err.message}`);
  }
  return byTicker;
}

/**
 * Fan a freshly computed fair value out to every row holding this ticker, flag the
 * ones that moved materially, and write those to the activity feed.
 */
function applyFairValueToRows({ db, entry, fairValue, price }) {
  const rows = db
    .prepare(
      `SELECT wi.id, wi.watchlist_id, wi.fair_value_at_add, wi.last_notified_fv,
              w.user_id, w.name AS watchlist_name
       FROM watchlist_items wi
       JOIN watchlists w ON w.id = wi.watchlist_id
       WHERE wi.ticker = ?`
    )
    .all(entry.ticker);
  if (!rows.length) return { updated: 0, flagged: 0, notified: 0 };

  const now = new Date().toISOString();
  const updateRow = db.prepare(
    `UPDATE watchlist_items
     SET last_known_fv=?, fv_updated_at=?, fv_change_reason=?,
         fair_value_at_add=COALESCE(fair_value_at_add, ?)
     WHERE id=?`
  );
  const markNotified = db.prepare("UPDATE watchlist_items SET last_notified_fv=? WHERE id=?");
  const logChange = db.prepare(
    "INSERT INTO activity_log (user_id, type, ticker, metadata) VALUES (?, 'watchlist_fv_change', ?, ?)"
  );

  const counts = { updated: 0, flagged: 0, notified: 0 };

  db.transaction(() => {
    for (const row of rows) {
      const change = detectFairValueChange({
        fairValueAtAdd: row.fair_value_at_add,
        lastKnownFv: fairValue,
        lastNotifiedFv: row.last_notified_fv,
        price,
      });

      updateRow.run(fairValue, now, change.reason, fairValue, row.id);
      counts.updated += 1;
      if (change.changed) counts.flagged += 1;
      if (!change.shouldNotify) continue;

      logChange.run(
        row.user_id,
        entry.ticker,
        JSON.stringify({
          watchlistId: row.watchlist_id,
          watchlistName: row.watchlist_name,
          reason: change.reason,
          movePct: change.move == null ? null : Number((change.move * 100).toFixed(2)),
          fairValueAtAdd: row.fair_value_at_add,
          lastKnownFv: fairValue,
          verdictAtAdd: change.verdictAtAdd,
          verdictNow: change.verdictNow,
          price,
          currency: entry.currency,
        })
      );
      markNotified.run(fairValue, row.id);
      counts.notified += 1;

      // The activity row above is what email alerts read: emailNotifications.js picks up
      // recent unsent 'watchlist_fv_change' rows and digests them, so detection lives
      // here only and is never repeated downstream.
    }
  })();

  return counts;
}

/**
 * Recompute fair value once per distinct watchlisted ticker, then fan out to rows.
 * Sequential with a delay between FMP fetches; cached tickers cost no request.
 */
export async function runWatchlistFairValueSweep({ db, apiKey, financialsStore, delayMs = 350 } = {}) {
  const tickers = db
    .prepare("SELECT DISTINCT ticker FROM watchlist_items")
    .all()
    .map((r) => r.ticker);
  const entries = tickers.map(resolveWatchlistTicker).filter(Boolean);
  const stats = {
    tickers: entries.length,
    unresolved: tickers.length - entries.length,
    updated: 0,
    flagged: 0,
    notified: 0,
    fetched: 0,
    failed: 0,
  };
  if (!entries.length) return stats;

  const priceByTicker = await pricesByTicker(entries, apiKey, Math.min(delayMs, 200));

  for (const entry of entries) {
    try {
      const { fairValue, fetched } = await fetchFairValueForSymbol({
        fmpSymbol: entry.fmpSymbol,
        apiKey,
        financialsStore,
      });
      if (fetched) {
        stats.fetched += 1;
        if (delayMs > 0) await sleep(delayMs);
      }
      if (fairValue == null) {
        stats.failed += 1;
        continue;
      }
      const counts = applyFairValueToRows({
        db,
        entry,
        fairValue,
        price: priceByTicker.get(entry.ticker) ?? null,
      });
      stats.updated += counts.updated;
      stats.flagged += counts.flagged;
      stats.notified += counts.notified;
    } catch (err) {
      stats.failed += 1;
      console.warn(`[watchlist/fv] ${entry.ticker}: ${err.message}`);
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  return stats;
}

/** True when watchlist rows exist and none were recomputed recently. */
export function watchlistFairValueIsStale(db, maxAgeMs = SWEEP_STALE_MS) {
  const row = db
    .prepare("SELECT COUNT(*) AS total, MAX(fv_updated_at) AS latest FROM watchlist_items")
    .get();
  if (!row?.total) return false;
  if (!row.latest) return true;
  const t = Date.parse(row.latest);
  return !Number.isFinite(t) || Date.now() - t >= maxAgeMs;
}

/** Run a sweep unless one is already in flight (mirrors the screener rebuild guard). */
export function runWatchlistFairValueSweepIfIdle(opts) {
  if (sweepPromise) return sweepPromise;
  sweepPromise = runWatchlistFairValueSweep(opts)
    .then((stats) => {
      console.log(
        `[watchlist/fv] sweep done — tickers=${stats.tickers} updated=${stats.updated} flagged=${stats.flagged} notified=${stats.notified} fetched=${stats.fetched} failed=${stats.failed}`
      );
      return stats;
    })
    .catch((err) => {
      console.error(`[watchlist/fv] sweep failed: ${err.message}`);
      return null;
    })
    .finally(() => {
      sweepPromise = null;
    });
  return sweepPromise;
}

/** Daily recompute, plus a catch-up run at boot when the last sweep is stale. */
export function startWatchlistFairValueCron({ db, financialsStore, apiKeyFn, delayMs }) {
  const run = () => {
    const apiKey = apiKeyFn?.();
    if (!apiKey) {
      console.warn("[watchlist/fv] skip sweep: FMP_API_KEY not configured");
      return;
    }
    void runWatchlistFairValueSweepIfIdle({ db, apiKey, financialsStore, delayMs });
  };

  if (watchlistFairValueIsStale(db)) {
    console.log("[watchlist/fv] last sweep is stale — scheduling catch-up run");
    setTimeout(run, SWEEP_BOOT_DELAY_MS);
  }
  setInterval(run, SWEEP_INTERVAL_MS);
  console.log("[watchlist/fv] daily fair-value sweep scheduled");
}
