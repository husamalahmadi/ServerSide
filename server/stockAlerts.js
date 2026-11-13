/**
 * Email alerts for stocks a signed-in user has viewed.
 *
 * Opening a stock page while signed in follows that stock and records what the reader
 * saw (price and fair value) as their baseline. A daily job recomputes each followed
 * stock, writes a `stock_alert_events` row when the change since that baseline is
 * material, resets the baseline, and mails each user one narrative email.
 *
 * Fair value is the same EV-based figure the watchlist sweep uses, so both alert
 * emails agree with each other.
 */
import { fairValueMove, fairValueVerdict } from "../shared/fairValueVerdict.js";
import { fetchAllBatchQuotes, num } from "./fmpBatchQuotes.js";
import { emailConfigured, sendEmail, unsubscribeTokenFor } from "./emailNotifications.js";
import { buildStockAlertEmail } from "./stockAlertEmail.js";
import { fetchFairValueForSymbol, resolveWatchlistTicker } from "./watchlistFairValue.js";

const USER_COLUMNS = [
  ["email_stock_alerts", "INTEGER DEFAULT 1"],
  ["email_lang", "TEXT"],
];

/** A price or fair-value move this large (as a fraction) is worth an email. */
export const STOCK_MATERIAL_MOVE = 0.05;
/** Stocks not reopened for this long stop being checked. */
const FOLLOW_ACTIVE_DAYS = 120;
/** Oldest follows beyond this count are dropped so one heavy browser can't grow the sweep. */
const MAX_FOLLOWS_PER_USER = 100;
/** A snapshot younger than this is fresh enough to use as a new visitor's baseline. */
const SNAPSHOT_FRESH_MS = 36 * 60 * 60 * 1000;
/** Only recent events are emailed, so an outage can't send a stale backlog later. */
const DISPATCH_WINDOW_HOURS = 72;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RUN_STALE_MS = 20 * 60 * 60 * 1000;
/** Start after the watchlist sweep so the two jobs don't hit FMP at the same time. */
const RUN_BOOT_DELAY_MS = 15 * 60 * 1000;
const DEFAULT_SEND_DELAY_MS = 400;

let runPromise = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function migrateStockAlertSchema(db) {
  const existing = new Set(db.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
  for (const [name, type] of USER_COLUMNS) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
    console.log(`[stock-alerts] migration: added users.${name}`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ticker TEXT NOT NULL,
      baseline_price REAL,
      baseline_fv REAL,
      baseline_at TEXT,
      last_viewed_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, ticker),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_follows_ticker ON stock_follows(ticker);

    CREATE TABLE IF NOT EXISTS stock_snapshots (
      ticker TEXT PRIMARY KEY,
      price REAL,
      fair_value REAL,
      currency TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_alert_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ticker TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      emailed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_alert_events_pending ON stock_alert_events(emailed_at, user_id);
  `);
}

function freshSnapshot(db, ticker) {
  const row = db.prepare("SELECT price, fair_value, updated_at FROM stock_snapshots WHERE ticker=?").get(ticker);
  if (!row?.updated_at) return null;
  const age = Date.now() - Date.parse(row.updated_at);
  return Number.isFinite(age) && age <= SNAPSHOT_FRESH_MS ? row : null;
}

/**
 * Follow a stock because the user just opened its page, and reset the baseline to what
 * they are looking at now — they've seen today's numbers, so only later changes count.
 * Without a fresh snapshot the baseline is cleared and the next run sets it silently.
 */
export function recordStockView(db, { userId, ticker, lang }) {
  const resolved = resolveWatchlistTicker(ticker);
  if (!userId || !resolved) return false;
  const snap = freshSnapshot(db, resolved.ticker);

  db.prepare(
    `INSERT INTO stock_follows (user_id, ticker, baseline_price, baseline_fv, baseline_at, last_viewed_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, ticker) DO UPDATE SET
       baseline_price=excluded.baseline_price,
       baseline_fv=excluded.baseline_fv,
       baseline_at=excluded.baseline_at,
       last_viewed_at=excluded.last_viewed_at`
  ).run(
    userId,
    resolved.ticker,
    snap?.price ?? null,
    snap?.fair_value ?? null,
    snap ? new Date().toISOString() : null
  );

  db.prepare(
    `DELETE FROM stock_follows WHERE user_id=? AND id NOT IN (
       SELECT id FROM stock_follows WHERE user_id=? ORDER BY last_viewed_at DESC LIMIT ?
     )`
  ).run(userId, userId, MAX_FOLLOWS_PER_USER);

  if (lang === "en" || lang === "ar") {
    db.prepare("UPDATE users SET email_lang=? WHERE id=?").run(lang, userId);
  }
  return true;
}

export function listStockFollows(db, userId) {
  return db
    .prepare(
      `SELECT ticker, last_viewed_at FROM stock_follows
       WHERE user_id=? ORDER BY last_viewed_at DESC`
    )
    .all(userId)
    .map((row) => ({
      ticker: row.ticker,
      name: resolveWatchlistTicker(row.ticker)?.name || null,
      last_viewed_at: row.last_viewed_at,
    }));
}

export function removeStockFollow(db, userId, ticker) {
  const t = String(ticker || "").trim().toUpperCase();
  if (!t) return false;
  return db.prepare("DELETE FROM stock_follows WHERE user_id=? AND ticker=?").run(userId, t).changes > 0;
}

/**
 * What changed for one follower, or null when nothing is worth an email.
 * Exported for tests; the sweep is the only production caller.
 */
export function detectStockChange({ baselinePrice, baselineFv, price, fairValue }) {
  const priceMove = fairValueMove(baselinePrice, price);
  const fvMove = fairValueMove(baselineFv, fairValue);
  const verdictThen = fairValueVerdict(baselinePrice, baselineFv);
  const verdictNow = fairValueVerdict(price, fairValue);
  const flipped = verdictThen != null && verdictNow != null && verdictThen !== verdictNow;
  const priceMoved = priceMove != null && Math.abs(priceMove) >= STOCK_MATERIAL_MOVE;
  const fvMoved = fvMove != null && Math.abs(fvMove) >= STOCK_MATERIAL_MOVE;
  if (!flipped && !priceMoved && !fvMoved) return null;
  return { priceMove, fvMove, verdictThen, verdictNow, flipped, priceMoved, fvMoved };
}

function activeFollowTickers(db) {
  return db
    .prepare(
      `SELECT DISTINCT ticker FROM stock_follows
       WHERE last_viewed_at >= datetime('now', ?)`
    )
    .all(`-${FOLLOW_ACTIVE_DAYS} days`)
    .map((r) => r.ticker);
}

async function pricesBySymbol(entries, apiKey) {
  const map = new Map();
  if (!entries.length) return map;
  try {
    const quotes = await fetchAllBatchQuotes(entries.map((e) => e.fmpSymbol), apiKey, { delayMs: 200 });
    for (const q of quotes) {
      const symbol = String(q?.symbol || "").toUpperCase();
      const price = num(q?.price);
      if (symbol && price != null && price > 0) map.set(symbol, price);
    }
  } catch (err) {
    console.warn(`[stock-alerts] batch quotes failed: ${err.message}`);
  }
  return map;
}

function applyToFollowers({ db, entry, price, fairValue }) {
  const nowIso = new Date().toISOString();
  db.prepare(
    `INSERT INTO stock_snapshots (ticker, price, fair_value, currency, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET
       price=COALESCE(excluded.price, price),
       fair_value=COALESCE(excluded.fair_value, fair_value),
       currency=excluded.currency,
       updated_at=excluded.updated_at`
  ).run(entry.ticker, price, fairValue, entry.currency, nowIso);

  const rows = db
    .prepare(
      `SELECT f.id, f.user_id, f.baseline_price, f.baseline_fv, f.baseline_at,
              u.email, COALESCE(u.email_stock_alerts, 1) AS opted_in
       FROM stock_follows f
       JOIN users u ON u.id = f.user_id
       WHERE f.ticker = ? AND f.last_viewed_at >= datetime('now', ?)`
    )
    .all(entry.ticker, `-${FOLLOW_ACTIVE_DAYS} days`);

  const setBaseline = db.prepare(
    "UPDATE stock_follows SET baseline_price=?, baseline_fv=?, baseline_at=? WHERE id=?"
  );
  const logEvent = db.prepare(
    "INSERT INTO stock_alert_events (user_id, ticker, metadata) VALUES (?, ?, ?)"
  );
  const counts = { followers: rows.length, events: 0 };

  db.transaction(() => {
    for (const row of rows) {
      const hasBaseline = row.baseline_price != null || row.baseline_fv != null;
      if (!hasBaseline) {
        setBaseline.run(price, fairValue, nowIso, row.id);
        continue;
      }
      const change = detectStockChange({
        baselinePrice: row.baseline_price,
        baselineFv: row.baseline_fv,
        price,
        fairValue,
      });
      if (!change) {
        // Fill a side the baseline was missing without moving the side we compare against.
        if (row.baseline_price == null || row.baseline_fv == null) {
          setBaseline.run(row.baseline_price ?? price, row.baseline_fv ?? fairValue, row.baseline_at, row.id);
        }
        continue;
      }
      // Opted-out readers keep their old baseline, so turning alerts back on reports
      // the change since they last actually looked.
      if (!row.opted_in || !String(row.email || "").trim()) continue;

      logEvent.run(
        row.user_id,
        entry.ticker,
        JSON.stringify({
          name: entry.name,
          currency: entry.currency,
          since: row.baseline_at,
          priceFrom: row.baseline_price,
          priceTo: price,
          priceMove: change.priceMove,
          fvFrom: row.baseline_fv,
          fvTo: fairValue,
          fvMove: change.fvMove,
          verdictThen: change.verdictThen,
          verdictNow: change.verdictNow,
          flipped: change.flipped,
          priceMoved: change.priceMoved,
          fvMoved: change.fvMoved,
        })
      );
      setBaseline.run(price, fairValue, nowIso, row.id);
      counts.events += 1;
    }
  })();

  return counts;
}

/** Recompute every followed stock once and record material changes per follower. */
export async function runStockAlertSweep({ db, apiKey, financialsStore, delayMs = 350 }) {
  const entries = activeFollowTickers(db).map(resolveWatchlistTicker).filter(Boolean);
  const stats = { tickers: entries.length, events: 0, failed: 0 };
  if (!entries.length || !apiKey) return stats;

  const priceMap = await pricesBySymbol(entries, apiKey);

  for (const entry of entries) {
    try {
      const { fairValue, fetched } = await fetchFairValueForSymbol({
        fmpSymbol: entry.fmpSymbol,
        apiKey,
        financialsStore,
      });
      if (fetched && delayMs > 0) await sleep(delayMs);
      const price = priceMap.get(entry.fmpSymbol.toUpperCase()) ?? null;
      if (price == null && fairValue == null) {
        stats.failed += 1;
        continue;
      }
      stats.events += applyToFollowers({ db, entry, price, fairValue }).events;
    } catch (err) {
      stats.failed += 1;
      console.warn(`[stock-alerts] ${entry.ticker}: ${err.message}`);
      if (delayMs > 0) await sleep(delayMs);
    }
  }
  return stats;
}

function pendingEventRows(db) {
  return db
    .prepare(
      `SELECT e.id, e.user_id, e.ticker, e.metadata,
              u.email, u.email_lang, u.unsubscribe_token
       FROM stock_alert_events e
       JOIN users u ON u.id = e.user_id
       WHERE e.emailed_at IS NULL
         AND e.created_at >= datetime('now', ?)
         AND u.email IS NOT NULL AND TRIM(u.email) <> ''
         AND COALESCE(u.email_stock_alerts, 1) = 1
       ORDER BY e.user_id, e.id`
    )
    .all(`-${DISPATCH_WINDOW_HOURS} hours`);
}

/**
 * One email per user covering every pending change. Rows are marked sent only after
 * the provider accepts the email, so failures retry on the next run.
 */
export async function runStockAlertEmailDispatch({ db, siteUrl, apiUrl, delayMs = DEFAULT_SEND_DELAY_MS }) {
  const byUser = new Map();
  for (const row of pendingEventRows(db)) {
    let entry = byUser.get(row.user_id);
    if (!entry) {
      entry = { userId: row.user_id, email: row.email, lang: row.email_lang, token: row.unsubscribe_token, events: [] };
      byUser.set(row.user_id, entry);
    }
    let metadata = {};
    try {
      metadata = JSON.parse(row.metadata);
    } catch {
      metadata = {};
    }
    entry.events.push({ id: row.id, ticker: row.ticker, ...metadata });
  }

  const recipients = [...byUser.values()];
  const stats = { users: recipients.length, emails: 0, failed: 0 };
  const markSent = db.prepare("UPDATE stock_alert_events SET emailed_at=datetime('now') WHERE id=?");

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const token = unsubscribeTokenFor(db, r.userId, r.token);
    const unsubscribeUrl = `${apiUrl}/api/email/unsubscribe?kind=stock&token=${encodeURIComponent(token)}`;
    const { subject, html, text } = buildStockAlertEmail({
      lang: r.lang === "ar" ? "ar" : "en",
      changes: r.events,
      siteUrl,
      unsubscribeUrl,
    });
    const result = await sendEmail({
      to: r.email,
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (result.ok) {
      db.transaction(() => {
        for (const ev of r.events) markSent.run(ev.id);
      })();
      stats.emails += 1;
    } else {
      stats.failed += 1;
      console.warn(`[stock-alerts] email to user ${r.userId} failed: ${result.error} (will retry)`);
    }
    if (delayMs > 0 && i < recipients.length - 1) await sleep(delayMs);
  }
  return stats;
}

/** Sweep then email, unless a run is already in flight. */
export function runStockAlertsIfIdle({ db, apiKey, financialsStore, siteUrl, apiUrl, delayMs, sendDelayMs }) {
  if (runPromise) return runPromise;
  runPromise = (async () => {
    const sweep = await runStockAlertSweep({ db, apiKey, financialsStore, delayMs });
    console.log(`[stock-alerts] sweep done — tickers=${sweep.tickers} events=${sweep.events} failed=${sweep.failed}`);
    if (!emailConfigured()) return { sweep, dispatch: null };
    const dispatch = await runStockAlertEmailDispatch({ db, siteUrl, apiUrl, delayMs: sendDelayMs });
    console.log(`[stock-alerts] dispatch done — users=${dispatch.users} emails=${dispatch.emails} failed=${dispatch.failed}`);
    return { sweep, dispatch };
  })()
    .catch((err) => {
      console.error(`[stock-alerts] run failed: ${err.message}`);
      return null;
    })
    .finally(() => {
      runPromise = null;
    });
  return runPromise;
}

function lastRunIsStale(db) {
  const follows = db.prepare("SELECT COUNT(*) AS n FROM stock_follows").get()?.n || 0;
  if (!follows) return false;
  const latest = db.prepare("SELECT MAX(updated_at) AS t FROM stock_snapshots").get()?.t;
  const t = latest ? Date.parse(latest) : NaN;
  return !Number.isFinite(t) || Date.now() - t >= RUN_STALE_MS;
}

/** Daily run, plus a boot catch-up when the last run is stale. Off without email config. */
export function startStockAlertCron({ db, financialsStore, apiKeyFn, siteUrl, apiUrl, delayMs, sendDelayMs }) {
  if (!emailConfigured()) {
    console.log("[stock-alerts] disabled: set RESEND_API_KEY and EMAIL_FROM to enable viewed-stock emails");
    return;
  }
  const run = () => {
    const apiKey = apiKeyFn?.();
    if (!apiKey) {
      console.warn("[stock-alerts] skip run: FMP_API_KEY not configured");
      return;
    }
    void runStockAlertsIfIdle({ db, apiKey, financialsStore, siteUrl, apiUrl, delayMs, sendDelayMs });
  };
  if (lastRunIsStale(db)) {
    console.log("[stock-alerts] last run is stale — scheduling catch-up run");
    setTimeout(run, RUN_BOOT_DELAY_MS);
  }
  setInterval(run, RUN_INTERVAL_MS);
  console.log("[stock-alerts] daily viewed-stock alerts scheduled");
}
