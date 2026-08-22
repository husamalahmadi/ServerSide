/**
 * Email alerts for watchlist fair-value changes.
 *
 * This module never re-runs change detection. `server/watchlistFairValue.js` already
 * decided what is material and deduped it via `last_notified_fv`; the rows it wrote to
 * activity_log are the source of truth here. This job reads the unsent ones, sends one
 * digest per user, and records what went out in `email_sends`.
 *
 * Works with no email configuration: the sender no-ops and the cron never schedules.
 */
import { randomBytes, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { buildFairValueDigestEmail } from "./emailTemplates.js";

const USER_COLUMNS = [
  ["email_fv_alerts", "INTEGER DEFAULT 1"],
  ["unsubscribe_token", "TEXT"],
];

/** Only recent changes are emailed, so a first deploy can't blast a backlog. */
const DISPATCH_WINDOW_HOURS = 48;
const DISPATCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** The sweep starts one minute after boot; give it room to finish before emailing. */
const DISPATCH_BOOT_DELAY_MS = 10 * 60 * 1000;
const DEFAULT_SEND_DELAY_MS = 400;

let dispatchPromise = null;
let resendClient = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function newToken() {
  return randomBytes(16).toString("hex");
}

export function emailFromAddress() {
  return (process.env.EMAIL_FROM || "").trim();
}

/** True when both the provider key and a From address are configured. */
export function emailConfigured() {
  return Boolean((process.env.RESEND_API_KEY || "").trim() && emailFromAddress());
}

/**
 * Add notification preferences, unsubscribe tokens, and the send ledger.
 * Existing users keep their rows and are opted in — they are authenticated account
 * holders who added these watchlists, and every email carries one-click unsubscribe.
 */
export function migrateEmailNotificationSchema(db) {
  const existing = new Set(db.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
  for (const [name, type] of USER_COLUMNS) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
    console.log(`[email] migration: added users.${name}`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'sent',
      UNIQUE(activity_id),
      FOREIGN KEY (activity_id) REFERENCES activity_log(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_email_sends_activity ON email_sends(activity_id);
    CREATE INDEX IF NOT EXISTS idx_email_sends_user ON email_sends(user_id);
  `);

  const missing = db
    .prepare("SELECT id FROM users WHERE unsubscribe_token IS NULL OR unsubscribe_token=''")
    .all();
  if (missing.length) {
    const setToken = db.prepare("UPDATE users SET unsubscribe_token=? WHERE id=?");
    db.transaction(() => {
      for (const row of missing) setToken.run(newToken(), row.id);
    })();
    console.log(`[email] migration: issued unsubscribe tokens for ${missing.length} user(s)`);
  }
}

/** Token for building a user's unsubscribe link, minted on demand if absent. */
export function unsubscribeTokenFor(db, userId, knownToken) {
  const token = String(knownToken || "").trim();
  if (token) return token;
  const fresh = newToken();
  db.prepare("UPDATE users SET unsubscribe_token=? WHERE id=?").run(fresh, userId);
  return fresh;
}

/** Turn fair-value emails off for the owner of this token. Unknown tokens are ignored. */
export function unsubscribeByToken(db, token) {
  const t = String(token || "").trim();
  if (!t) return false;
  const user = db.prepare("SELECT id FROM users WHERE unsubscribe_token=?").get(t);
  if (!user) return false;
  db.prepare("UPDATE users SET email_fv_alerts=0, updated_at=datetime('now') WHERE id=?").run(user.id);
  console.log(`[email] user ${user.id} unsubscribed from fair-value alerts`);
  return true;
}

/** Compare a request secret against an env secret without leaking length timing. */
export function secretMatches(provided, expected) {
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(String(expected || ""));
  if (!a.length || !b.length || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Send one email. Never throws — callers get `{ ok, id?, error? }` so a provider
 * outage can't take down a cron run.
 */
export async function sendEmail({ to, subject, html, text, headers }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = emailFromAddress();
  if (!apiKey || !from) {
    console.warn("[email] skip send: RESEND_API_KEY or EMAIL_FROM not configured");
    return { ok: false, error: "email_not_configured" };
  }
  if (!to) return { ok: false, error: "missing_recipient" };

  try {
    if (!resendClient) resendClient = new Resend(apiKey);
    const { data, error } = await resendClient.emails.send({ from, to, subject, html, text, headers });
    if (error) return { ok: false, error: error.message || String(error) };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Change rows that still need an email: recent, not already sent, belonging to a user
 * with an address who has not opted out.
 */
function pendingChangeRows(db) {
  return db
    .prepare(
      `SELECT a.id, a.user_id, a.ticker, a.metadata, a.created_at,
              u.email, u.unsubscribe_token
       FROM activity_log a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN email_sends es ON es.activity_id = a.id
       WHERE a.type = 'watchlist_fv_change'
         AND es.id IS NULL
         AND a.created_at >= datetime('now', ?)
         AND u.email IS NOT NULL AND TRIM(u.email) <> ''
         AND COALESCE(u.email_fv_alerts, 1) = 1
       ORDER BY a.user_id, a.id`
    )
    .all(`-${DISPATCH_WINDOW_HOURS} hours`);
}

/** True when there is anything worth waking the dispatcher for. */
export function hasPendingFairValueEmails(db) {
  return pendingChangeRows(db).length > 0;
}

function groupByUser(rows) {
  const byUser = new Map();
  for (const row of rows) {
    let entry = byUser.get(row.user_id);
    if (!entry) {
      entry = { userId: row.user_id, email: row.email, token: row.unsubscribe_token, changes: [] };
      byUser.set(row.user_id, entry);
    }
    let metadata = {};
    try {
      metadata = row.metadata ? JSON.parse(row.metadata) : {};
    } catch {
      metadata = {};
    }
    entry.changes.push({ activityId: row.id, ticker: row.ticker, metadata });
  }
  return [...byUser.values()];
}

/**
 * One digest email per user covering all their pending changes.
 *
 * Retry policy: a send is recorded only after the provider accepts it, so a failure
 * leaves those rows pending and the next run retries them. Retries are naturally
 * bounded — once a change ages past the dispatch window it is dropped rather than
 * chased forever.
 *
 * @param {{ db: object, siteUrl: string, apiUrl: string, delayMs?: number }} args
 */
export async function runFairValueEmailDispatch({ db, siteUrl, apiUrl, delayMs = DEFAULT_SEND_DELAY_MS }) {
  const recipients = groupByUser(pendingChangeRows(db));
  const stats = { users: recipients.length, emails: 0, changes: 0, failed: 0 };
  if (!recipients.length) return stats;

  const recordSend = db.prepare(
    "INSERT OR IGNORE INTO email_sends (activity_id, user_id, status) VALUES (?, ?, 'sent')"
  );

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const token = unsubscribeTokenFor(db, recipient.userId, recipient.token);
    const unsubscribeUrl = `${apiUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = buildFairValueDigestEmail({
      changes: recipient.changes,
      siteUrl,
      unsubscribeUrl,
    });

    const result = await sendEmail({
      to: recipient.email,
      subject,
      html,
      text,
      // RFC 8058: lets Gmail and Outlook show their own unsubscribe control, which they
      // action with a POST to this URL. Mail clients read it as a sender-quality signal.
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (result.ok) {
      db.transaction(() => {
        for (const change of recipient.changes) recordSend.run(change.activityId, recipient.userId);
      })();
      stats.emails += 1;
      stats.changes += recipient.changes.length;
    } else {
      stats.failed += 1;
      console.warn(`[email] digest to user ${recipient.userId} failed: ${result.error} (will retry)`);
    }

    if (delayMs > 0 && i < recipients.length - 1) await sleep(delayMs);
  }

  return stats;
}

/** Run a dispatch unless one is already in flight (mirrors the sweep's guard). */
export function runFairValueEmailDispatchIfIdle(opts) {
  if (dispatchPromise) return dispatchPromise;
  dispatchPromise = runFairValueEmailDispatch(opts)
    .then((stats) => {
      console.log(
        `[email] dispatch done — users=${stats.users} emails=${stats.emails} changes=${stats.changes} failed=${stats.failed}`
      );
      return stats;
    })
    .catch((err) => {
      console.error(`[email] dispatch failed: ${err.message}`);
      return null;
    })
    .finally(() => {
      dispatchPromise = null;
    });
  return dispatchPromise;
}

/**
 * Daily digest run, offset to land after the fair-value sweep, plus a boot catch-up
 * when changes are already waiting. Not scheduled at all without email configuration.
 *
 * On Render's free tier this timer only fires while the process is awake — see the
 * protected trigger route in server.js for the reliable external-scheduler path.
 */
export function startFairValueEmailCron({ db, siteUrl, apiUrl, delayMs }) {
  if (!emailConfigured()) {
    console.log("[email] disabled: set RESEND_API_KEY and EMAIL_FROM to enable fair-value alerts");
    return;
  }

  const run = () => void runFairValueEmailDispatchIfIdle({ db, siteUrl, apiUrl, delayMs });

  if (hasPendingFairValueEmails(db)) {
    console.log("[email] pending fair-value changes found — scheduling catch-up dispatch");
    setTimeout(run, DISPATCH_BOOT_DELAY_MS);
  }
  setInterval(run, DISPATCH_INTERVAL_MS);
  console.log("[email] daily fair-value digest scheduled");
}
