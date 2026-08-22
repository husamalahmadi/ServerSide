import dotenv from "dotenv";
import compression from "compression";
import express from "express";
import session from "express-session";
import cors from "cors";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "fs";
import {
  createFinancialsStore,
  resolveFmpFinancialsDir,
  validateFmpFinancialsBundle,
  INCOMPLETE_DATA_CODE,
  INCOMPLETE_USER_MESSAGE,
} from "./fmpFinancialsStore.js";
import { fetchFmpFinancialsBundle, fmpApiKey, FMP_STABLE_BASE } from "./fmpFetch.js";
import { resolveFmpLogoUrl } from "../shared/fmpLogoUrl.js";
import { createScreenerStore, resolveScreenerDir, SCREENER_MARKETS } from "./screenerStore.js";
import { buildAllScreeners } from "./buildScreenerFromFmp.js";
import { buildSaMarketDashboard } from "./saMarketDashboard.js";
import {
  buildUsMarketUniverse,
  buildSaMarketUniverse,
  getMarketUniverse,
} from "./marketUniverse.js";
import { MARKET_UNIVERSE_TTL_MS } from "./marketUniverseCache.js";
import { buildHomeSignals } from "./homeSignals.js";
import { getHomeSignals, HOME_SIGNALS_TTL_MS } from "./homeSignalsCache.js";
import { dcfSymbolCandidates, fetchDcfWithFallback } from "./fmpDcf.js";
import { fetchFairValueChartData } from "./fmpFairValueChart.js";
import { buildStocksCatalogPayload } from "./stocksCatalogApi.js";
import { findStockByTicker, CURRENCY_BY_MARKET, getCatalogPools } from "./stockCatalogLookup.js";
import {
  migrateWatchlistFairValueColumns,
  runWatchlistFairValueSweepIfIdle,
  snapshotFairValueOnAdd,
  startWatchlistFairValueCron,
  watchlistItemCurrency,
  WATCHLIST_ITEM_FV_COLUMNS,
} from "./watchlistFairValue.js";
import {
  emailConfigured,
  migrateEmailNotificationSchema,
  runFairValueEmailDispatchIfIdle,
  secretMatches,
  startFairValueEmailCron,
  unsubscribeByToken,
} from "./emailNotifications.js";
import { renderUnsubscribeConfirmPage, renderUnsubscribePage } from "./emailTemplates.js";
import { injectSeoIntoSpaHtml, buildStockStaticFallback } from "./spaHtmlSeo.js";
import { configureSeoSiteUrl } from "../shared/seo/siteUrl.js";
import { buildStockSeo, buildTutorialArticleSeo, buildTutorialsIndexSeo } from "../shared/seo/structuredData.js";
import { buildTutorialSpaStaticFallback } from "../shared/seo/tutorialStatic.js";
import { parseTutorialPath } from "../shared/seo/tutorialPaths.js";
import { TUTORIAL_ARTICLES, TUTORIAL_BY_SLUG } from "../src/data/tutorials/articles.js";
import { resolveTutorialArticle, resolveTutorialArticles } from "../src/data/tutorials/resolve.js";
import { isUsableScreenerRow, screenerMarketUsable } from "../src/domain/screenerMetrics.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { validateComment } from "./commentFilter.js";
import SqliteStoreFactory from "better-sqlite3-session-store";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load env from repo root first, then server/.env (later file wins — keeps FMP_API_KEY next to server.js).
dotenv.config({ path: join(__dirname, "..", ".env") });
dotenv.config({ path: join(__dirname, ".env") });
if (!(process.env.FMP_API_KEY || "").trim()) {
  console.warn("[fmp] FMP_API_KEY is unset — stock quotes/profiles will fail until you set it (server/.env or repo-root .env).");
}
const DB_PATH = (process.env.DB_PATH || "").trim();
const dbPath = DB_PATH || join(__dirname, "trueprice.db");
const dbDir = dirname(dbPath);
if (dbDir && !existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
console.log(`[db] Using SQLite at ${dbPath}`);
const db = new Database(dbPath);

// Init schema
const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
db.exec(schema);

// Migrations: add new columns if missing
const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!cols.includes("date_of_birth")) db.exec("ALTER TABLE users ADD COLUMN date_of_birth TEXT");
if (!cols.includes("profile_completed")) {
  db.exec("ALTER TABLE users ADD COLUMN profile_completed INTEGER DEFAULT 0");
  db.exec("UPDATE users SET profile_completed=1"); // Existing users already have profiles
}
if (!cols.includes("current_session_id")) db.exec("ALTER TABLE users ADD COLUMN current_session_id TEXT");
migrateWatchlistFairValueColumns(db);
migrateEmailNotificationSchema(db);
const portCols = db.prepare("PRAGMA table_info(portfolios)").all().map((c) => c.name);
if (!portCols.includes("cash")) {
  db.exec("ALTER TABLE portfolios ADD COLUMN cash REAL NOT NULL DEFAULT 100000");
  // For existing portfolios: cash = initial - cost of current holdings (no trade history stored)
  const all = db.prepare("SELECT id, initial_cash FROM portfolios").all();
  all.forEach((row) => {
    const spent = db.prepare(
      "SELECT COALESCE(SUM(shares * avg_cost), 0) as s FROM portfolio_holdings WHERE portfolio_id=?"
    ).get(row.id);
    const cash = Math.max(0, (row.initial_cash || 0) - (spent?.s || 0));
    db.prepare("UPDATE portfolios SET cash=? WHERE id=?").run(cash, row.id);
  });
}

/** Trailing slashes break OAuth redirects vs browser URL; normalize public URLs. */
function normalizePublicUrl(s) {
  const t = (s || "").trim();
  if (!t) return t;
  return t.replace(/\/+$/, "");
}

/** Relative SPA path only — blocks open redirects after Google OAuth. */
function sanitizeOAuthReturnPath(path) {
  if (typeof path !== "string") return "/";
  const raw = path.trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (/[\s\\]/.test(raw)) return "/";
  const qIdx = raw.indexOf("?");
  const pathname = (qIdx >= 0 ? raw.slice(0, qIdx) : raw) || "/";
  let search = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
  if (search) {
    const sp = new URLSearchParams(search);
    sp.delete("tp_session");
    sp.delete("auth");
    const rest = sp.toString();
    search = rest ? `?${rest}` : "";
  }
  if (pathname.startsWith("/auth")) return "/";
  return pathname + search;
}

const CLIENT_URL_RAW = process.env.CLIENT_URL || "http://localhost:5173";
/** First origin is used for OAuth redirects; allow comma-separated list for CORS. */
const CLIENT_URL = normalizePublicUrl(CLIENT_URL_RAW.split(",")[0].trim());
const SERVER_URL = normalizePublicUrl(process.env.SERVER_URL || "http://localhost:3001");
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";
const IS_PROD = process.env.NODE_ENV === "production";
const REDIS_URL = (process.env.REDIS_URL || "").trim();
const CANONICAL_HOST = (process.env.CANONICAL_HOST || "trueprice.cash").trim().toLowerCase();
const CANONICAL_ALIASES = new Set(
  [`www.${CANONICAL_HOST}`, ...(process.env.CANONICAL_ALIASES || "").split(",")]
    .map((s) => s.trim().toLowerCase())
    .filter((s) => Boolean(s) && s !== CANONICAL_HOST)
);
const FORCE_CANONICAL_HOST = process.env.FORCE_CANONICAL_HOST === "true";
const SINGLE_SESSION_PER_USER = process.env.SINGLE_SESSION_PER_USER === "true";

if (IS_PROD && (!process.env.SESSION_SECRET || SESSION_SECRET === "dev-secret-change-in-production")) {
  throw new Error("SESSION_SECRET must be set to a stable, long random value in production.");
}

/** When frontend (e.g. Cloudflare) and API (e.g. Railway) differ, credentialed fetch needs SameSite=None. */
function getSessionCookieSameSite() {
  const override = process.env.SESSION_COOKIE_SAMESITE;
  if (override === "none" || override === "lax" || override === "strict") return override;
  if (process.env.NODE_ENV !== "production") return "lax";
  try {
    if (new URL(CLIENT_URL).origin !== new URL(SERVER_URL).origin) return "none";
  } catch {
    /* ignore */
  }
  return "lax";
}

/** Comma-separated in CLIENT_URL, plus known production web origins (custom domain + Render). */
const EXTRA_CORS_ORIGINS = [
  "https://trueprice.cash",
  "https://www.trueprice.cash",
  "https://trueprice-api.onrender.com",
];
const corsAllowedOrigins = [
  ...new Set([
    ...CLIENT_URL_RAW.split(",")
      .map((s) => normalizePublicUrl(s.trim()))
      .filter(Boolean),
    ...EXTRA_CORS_ORIGINS,
    ...(process.env.CORS_EXTRA_ORIGINS || "")
      .split(",")
      .map((s) => normalizePublicUrl(s.trim()))
      .filter(Boolean),
  ]),
];
function isDevLocalOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (corsAllowedOrigins.includes(origin)) return callback(null, true);
  // Same host as the API (single Render URL for UI + API): subresource requests send Origin; must not 500 if CLIENT_URL only lists another host (e.g. Cloudflare).
  try {
    if (origin === new URL(SERVER_URL).origin) return callback(null, true);
  } catch {
    /* ignore invalid SERVER_URL */
  }
  if (process.env.NODE_ENV !== "production" && isDevLocalOrigin(origin)) return callback(null, true);
  callback(new Error("Not allowed by CORS"));
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${SERVER_URL}/auth/google/callback`,
    },
    (accessToken, refreshToken, profile, done) => {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      const picture = profile.photos?.[0]?.value;

      let user = db.prepare("SELECT * FROM users WHERE google_id = ?").get(googleId);
      if (!user) {
        const handle = `user${Date.now().toString(36)}`;
        const stmt = db.prepare(
          "INSERT INTO users (google_id, email, name, picture, handle, profile_completed) VALUES (?, ?, ?, ?, ?, 0)"
        );
        stmt.run(googleId, email || null, name || null, picture || null, handle);
        user = db.prepare("SELECT * FROM users WHERE google_id = ?").get(googleId);
      } else {
        db.prepare("UPDATE users SET email=?, name=?, picture=?, updated_at=datetime('now') WHERE id=?")
          .run(email || user.email, name || user.name, picture || user.picture, user.id);
        user = db.prepare("SELECT * FROM users WHERE google_id = ?").get(googleId);
      }
      return done(null, user);
    }
  )
);
} else {
  console.warn("Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env for sign-in.");
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  done(null, user || null);
});

/** Vite `outDir` is `server/static` (same folder as this file) — works regardless of process.cwd(). */
const staticPath = join(__dirname, "static");
if (!existsSync(join(staticPath, "index.html"))) {
  console.error(
    `[static] Missing ${join(staticPath, "index.html")}. Run "npm run build" at repo root (Vite writes to server/static).`
  );
} else {
  console.log(`[static] Serving Vite build from ${staticPath}`);
}

const app = express();
app.use(compression());
if (IS_PROD) {
  app.set("trust proxy", 1);
}
if (IS_PROD && FORCE_CANONICAL_HOST) {
  app.use((req, res, next) => {
    // Cloudflare usually handles host/protocol redirects; skip app-level redirect to avoid ping-pong loops.
    if (req.headers["cf-visitor"]) return next();
    const hostHeader = (req.headers.host || "").toString().toLowerCase();
    const host = hostHeader.split(":")[0];
    if (!host || host === CANONICAL_HOST) return next();
    if (!CANONICAL_ALIASES.has(host)) return next();
    const protoHeader = (req.headers["x-forwarded-proto"] || "").toString();
    const proto = (protoHeader.split(",")[0] || req.protocol || "https").trim();
    const location = `${proto}://${CANONICAL_HOST}${req.originalUrl || "/"}`;
    if (`${proto}://${host}${req.originalUrl || "/"}` === location) return next();
    return res.redirect(301, location);
  });
}
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json());

// Session + OAuth before express.static so /auth/google is never handled by static middleware first.
const sessionSameSite = getSessionCookieSameSite();
let sessionStore;
if (REDIS_URL) {
  const redisClient = createClient({ url: REDIS_URL });
  redisClient.on("error", (e) => console.error("[redis]", e?.message || e));
  await redisClient.connect();
  sessionStore = new RedisStore({ client: redisClient, prefix: "tp:sess:" });
  console.log("[session] Using Redis session store");
} else {
  // Persist sessions in the same SQLite database so they survive PM2 restarts and deploys.
  const SqliteStore = SqliteStoreFactory(session);
  sessionStore = new SqliteStore({ client: db, expired: { clear: true, intervalMs: 15 * 60 * 1000 } });
  console.log("[session] Using SQLite session store (persistent across restarts)");
}
app.use(
  session({
    secret: SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: IS_PROD,
      httpOnly: true,
      sameSite: sessionSameSite,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());
if (SINGLE_SESSION_PER_USER) {
  app.use((req, res, next) => {
    if (!req.user || !req.sessionID) return next();
    const row = db.prepare("SELECT current_session_id FROM users WHERE id=?").get(req.user.id);
    const currentSessionId = row?.current_session_id || null;
    if (!currentSessionId || currentSessionId === req.sessionID) return next();
    req.logout(() => {});
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Session expired. Signed in from another device." });
  });
}

// Auth routes
app.get("/auth/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${CLIENT_URL}/?auth=not_configured`);
  }
  const returnTo = sanitizeOAuthReturnPath(req.query?.returnTo);
  req.session.oauthReturnTo = returnTo;
  req.session.save((err) => {
    if (err) {
      console.error("[auth/google] session save:", err.message);
      return next(err);
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });
});
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${CLIENT_URL}/?auth=failed` }),
  (req, res) => {
    if (req.user?.id && req.sessionID) {
      db.prepare("UPDATE users SET current_session_id=?, updated_at=datetime('now') WHERE id=?").run(req.sessionID, req.user.id);
    }
    const returnTo = sanitizeOAuthReturnPath(req.session?.oauthReturnTo);
    delete req.session.oauthReturnTo;
    const needsSetup = req.user && !req.user.profile_completed;
    if (needsSetup) {
      req.session.oauthReturnTo = returnTo;
    }
    const rel = needsSetup ? "/profile/setup" : returnTo;
    const target = new URL(rel, `${CLIENT_URL.replace(/\/+$/, "")}/`);
    // Hint SPA to poll /auth/me longer (cold start + cross-origin cookie timing).
    target.searchParams.set("tp_session", "1");
    req.session.save((err) => {
      if (err) console.error("[auth/google/callback] session save:", err.message);
      res.redirect(target.toString());
    });
  }
);
app.get("/auth/me", (req, res) => {
  if (!req.user) return res.json({ user: null });
  // The unsubscribe token acts as a bearer link from email; it never needs to reach the SPA.
  const { unsubscribe_token: _token, ...user } = req.user;
  res.json({ user });
});
app.post("/auth/logout", (req, res) => {
  const userId = req.user?.id ?? null;
  const sid = req.sessionID || null;
  req.logout(() => {
    if (userId) {
      db.prepare(
        "UPDATE users SET current_session_id=NULL, updated_at=datetime('now') WHERE id=? AND (current_session_id IS NULL OR current_session_id=?)"
      ).run(userId, sid);
    }
    req.session?.destroy(() => {
      // Explicitly clear the session cookie so the browser does not send a dead session ID.
      res.clearCookie("connect.sid", { path: "/", httpOnly: true, sameSite: getSessionCookieSameSite(), secure: IS_PROD });
      res.json({ ok: true });
    });
  });
});

// Static assets after OAuth. Hashed chunks do not need session (minor overhead on /assets/* is acceptable).
if (existsSync(staticPath)) {
  app.use(
    express.static(staticPath, {
      index: "index.html",
      setHeaders(res, filePath) {
        try {
          if (!filePath) return;
          const normalized = String(filePath).replace(/\\/g, "/");
          if (normalized.endsWith("/index.html")) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          } else if (normalized.endsWith("/llms.txt") || normalized.endsWith("/robots.txt")) {
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Cache-Control", "public, max-age=86400");
          } else {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        } catch (e) {
          console.error("[static] setHeaders:", e?.message || e);
        }
      },
    })
  );
} else {
  console.error(`[static] Directory missing — not mounting express.static: ${staticPath}`);
}

// Require auth middleware
const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
};
const requireGoogleAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (!req.user.google_id) {
    return res.status(403).json({ error: "Google sign-in required" });
  }
  next();
};

// User profile: update own profile (picture comes from Google only, not editable)
app.patch("/api/users/me", requireAuth, (req, res) => {
  const { handle, name, bio, dateOfBirth } = req.body || {};
  const currentUser = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);

  // Start with only the timestamp — profile_completed=1 is only added when a valid handle is saved.
  const updates = ["updated_at=datetime('now')"];
  const params = [];

  if (!currentUser.profile_completed) {
    // First-time setup: a valid handle is REQUIRED to mark the profile as complete.
    if (typeof handle === "string" && handle.trim()) {
      const h = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (h.length < 3 || h.length > 30) {
        return res.status(400).json({ error: "Username must be 3–30 characters (letters, numbers, underscores)" });
      }
      const existing = db.prepare("SELECT id FROM users WHERE handle=? AND id!=?").get(h, req.user.id);
      if (existing) return res.status(400).json({ error: "Username already taken" });
      updates.push("handle=?", "profile_completed=1");
      params.push(h);
    }
    // If no handle is provided (e.g. partial save), we do NOT set profile_completed.
    // The user will be prompted to complete their profile on next login.
  }
  // Once profile_completed=1, handle is permanently locked — silently ignore any handle in body.

  // Display name, bio, and date of birth are always editable (before and after setup).
  if (typeof name === "string") { updates.push("name=?"); params.push(name.trim() || null); }
  if (typeof bio === "string") { updates.push("bio=?"); params.push(bio.trim() || null); }
  if (typeof dateOfBirth === "string") { updates.push("date_of_birth=?"); params.push(dateOfBirth.trim() || null); }

  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id=?`).run(...params);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ user });
});

const WATCHLIST_ITEMS_SQL = `SELECT ticker, created_at, ${WATCHLIST_ITEM_FV_COLUMNS}
   FROM watchlist_items WHERE watchlist_id=? ORDER BY datetime(created_at) DESC`;

/** Watchlist row for the client: ticker plus its fair-value snapshot and change flag. */
function watchlistItemsFor(watchlistId) {
  return db
    .prepare(WATCHLIST_ITEMS_SQL)
    .all(watchlistId)
    .map((i) => ({
      ticker: i.ticker,
      created_at: i.created_at || null,
      fair_value_at_add: i.fair_value_at_add ?? null,
      last_known_fv: i.last_known_fv ?? null,
      fv_updated_at: i.fv_updated_at || null,
      fv_change_reason: i.fv_change_reason || null,
      currency: watchlistItemCurrency(i.ticker),
    }));
}

// User profile: get profile by handle (watchlists, comments). Owner sees all lists; others only public.
app.get("/api/users/:handle", (req, res) => {
  const { handle } = req.params;
  const u = db.prepare("SELECT id, handle, name, picture, bio, date_of_birth, created_at FROM users WHERE handle=?").get(handle);
  if (!u) return res.status(404).json({ error: "User not found" });
  const viewerId = req.user?.id ?? null;
  const isOwner = viewerId != null && viewerId === u.id;
  const watchlistsSql = isOwner
    ? "SELECT w.* FROM watchlists w WHERE w.user_id=? ORDER BY w.created_at DESC"
    : "SELECT w.* FROM watchlists w WHERE w.user_id=? AND w.is_public=1 ORDER BY w.created_at DESC";
  const watchlists = db.prepare(watchlistsSql).all(u.id).map((w) => ({
    ...w,
    items: watchlistItemsFor(w.id),
  }));
  const comments = db.prepare(
    `SELECT c.id, c.ticker, c.body, c.created_at,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id=c.id) as like_count
     FROM comments c WHERE c.user_id=? ORDER BY c.created_at DESC LIMIT 100`
  ).all(u.id);
  res.json({ user: u, watchlists, comments });
});

// Activity
app.post("/api/activity", requireAuth, (req, res) => {
  const { type, ticker, metadata } = req.body || {};
  if (!type) return res.status(400).json({ error: "type required" });
  const stmt = db.prepare(
    "INSERT INTO activity_log (user_id, type, ticker, metadata) VALUES (?, ?, ?, ?)"
  );
  stmt.run(req.user.id, type, ticker || null, metadata ? JSON.stringify(metadata) : null);
  res.json({ ok: true });
});
app.get("/api/activity/me", requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
  ).all(req.user.id);
  res.json({ items: rows });
});

// Email notification preferences
app.put("/api/me/email-prefs", requireAuth, (req, res) => {
  const { emailFvAlerts } = req.body || {};
  if (typeof emailFvAlerts !== "boolean") {
    return res.status(400).json({ error: "emailFvAlerts must be a boolean" });
  }
  db.prepare("UPDATE users SET email_fv_alerts=?, updated_at=datetime('now') WHERE id=?").run(
    emailFvAlerts ? 1 : 0,
    req.user.id
  );
  res.json({ ok: true, emailFvAlerts });
});

/**
 * Unsubscribe from an email link — no auth, and neutral for unknown tokens either way.
 *
 * The GET only asks, because mail clients and security scanners prefetch links in email
 * and would otherwise unsubscribe people who never clicked. The POST is what acts on it,
 * serving both the page's button and the one-click control Gmail and Outlook render from
 * the List-Unsubscribe headers.
 */
app.get("/api/email/unsubscribe", (req, res) => {
  res
    .status(200)
    .type("html")
    .send(renderUnsubscribeConfirmPage({ siteUrl: CLIENT_URL, token: req.query?.token }));
});

app.post("/api/email/unsubscribe", (req, res) => {
  unsubscribeByToken(db, req.query?.token);
  res.status(200).type("html").send(renderUnsubscribePage({ siteUrl: CLIENT_URL }));
});

/**
 * Both daily jobs also run on in-process timers, but Render's free tier sleeps, so those
 * timers can miss days. These routes let one external scheduler (e.g. cron-job.org) drive
 * the sweep first and the email digest a few minutes later, which is the only reliable
 * order — the digest can only mail changes the sweep has already found.
 */
const requireInternalToken = (req, res, next) => {
  const expected = (process.env.INTERNAL_TASK_TOKEN || "").trim();
  if (!expected) return res.status(503).json({ error: "INTERNAL_TASK_TOKEN not configured" });
  if (!secretMatches(req.get("x-internal-token"), expected)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

app.post("/api/internal/run-sweep", requireInternalToken, (req, res) => {
  const apiKey = fmpApiKey();
  if (!apiKey) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  void runWatchlistFairValueSweepIfIdle({
    db,
    apiKey,
    financialsStore: fmpFinancialsStore,
    delayMs: Number(process.env.WATCHLIST_FV_DELAY_MS || 350),
  });
  res.status(202).json({ ok: true, started: true });
});

app.post("/api/internal/dispatch-emails", requireInternalToken, (req, res) => {
  if (!emailConfigured()) return res.status(503).json({ error: "email not configured" });
  void runFairValueEmailDispatchIfIdle({ db, siteUrl: CLIENT_URL, apiUrl: SERVER_URL });
  res.status(202).json({ ok: true, started: true });
});

// Comments
app.get("/api/comments/:ticker", (req, res) => {
  const { ticker } = req.params;
  const rows = db.prepare(
    `SELECT c.*, u.name as author_name, u.handle as author_handle, u.picture as author_picture,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as user_liked
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.ticker = ? AND c.parent_id IS NULL
     ORDER BY c.created_at DESC`
  ).all(req.user?.id ?? 0, ticker.toUpperCase());
  const replies = db.prepare(
    `SELECT c.*, u.name as author_name, u.handle as author_handle, u.picture as author_picture,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as user_liked
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.ticker = ? AND c.parent_id IS NOT NULL
     ORDER BY c.created_at ASC`
  ).all(req.user?.id ?? 0, ticker.toUpperCase());
  const byParent = {};
  replies.forEach((r) => {
    if (!byParent[r.parent_id]) byParent[r.parent_id] = [];
    byParent[r.parent_id].push(r);
  });
  const comments = rows.map((c) => ({ ...c, replies: byParent[c.id] || [] }));
  res.json({ comments });
});
app.post("/api/comments/:ticker", requireGoogleAuth, (req, res) => {
  const { ticker } = req.params;
  const { body, parentId } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: "body required" });
  const validation = validateComment(body.trim());
  if (!validation.valid) return res.status(400).json({ error: validation.reason });
  const stmt = db.prepare(
    "INSERT INTO comments (user_id, ticker, body, parent_id) VALUES (?, ?, ?, ?)"
  );
  stmt.run(req.user.id, ticker.toUpperCase(), validation.filtered, parentId || null);
  const row = db.prepare("SELECT last_insert_rowid() as id").get();
  res.status(201).json({ id: row.id });
});
app.post("/api/comments/:id/like", requireGoogleAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare("SELECT id FROM comment_likes WHERE user_id=? AND comment_id=?").get(req.user.id, id);
  if (existing) {
    db.prepare("DELETE FROM comment_likes WHERE id=?").run(existing.id);
    res.json({ liked: false });
  } else {
    db.prepare("INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)").run(req.user.id, id);
    res.json({ liked: true });
  }
});
app.delete("/api/comments/:id", requireGoogleAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const c = db.prepare("SELECT * FROM comments WHERE id=?").get(id);
  if (!c) return res.status(404).json({ error: "Not found" });
  if (c.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  db.prepare("DELETE FROM comment_likes WHERE comment_id=?").run(id);
  db.prepare("DELETE FROM comments WHERE id=?").run(id);
  res.json({ ok: true });
});

// Watchlists
app.get("/api/watchlists/me", requireAuth, (req, res) => {
  const lists = db.prepare("SELECT * FROM watchlists WHERE user_id=? ORDER BY created_at DESC").all(req.user.id);
  const withItems = lists.map((l) => ({ ...l, items: watchlistItemsFor(l.id) }));
  res.json({ watchlists: withItems });
});
app.get("/api/watchlists/:handle/:slug", (req, res) => {
  const { handle, slug } = req.params;
  const u = db.prepare("SELECT id FROM users WHERE handle=?").get(handle);
  if (!u) return res.status(404).json({ error: "User not found" });
  const list = db.prepare("SELECT * FROM watchlists WHERE user_id=? AND slug=? AND is_public=1").get(u.id, slug);
  if (!list) return res.status(404).json({ error: "Watchlist not found" });
  res.json({ ...list, items: watchlistItemsFor(list.id) });
});
app.post("/api/watchlists", requireGoogleAuth, (req, res) => {
  const { name, isPublic = true } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name required" });
  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const stmt = db.prepare("INSERT INTO watchlists (user_id, name, slug, is_public) VALUES (?, ?, ?, ?)");
  stmt.run(req.user.id, name.trim(), slug || "list", isPublic ? 1 : 0);
  const row = db.prepare("SELECT last_insert_rowid() as id").get();
  res.status(201).json({ id: row.id, name: name.trim(), slug: slug || "list", is_public: isPublic ? 1 : 0 });
});
app.put("/api/watchlists/:id/items", requireGoogleAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid watchlist id" });
  const { ticker, action } = req.body || {};
  const list = db.prepare("SELECT * FROM watchlists WHERE id=? AND user_id=?").get(id, req.user.id);
  if (!list) return res.status(404).json({ error: "Not found" });
  const t = (ticker || "").toUpperCase().trim();
  if (!t) return res.status(400).json({ error: "ticker required" });
  if (action !== "add" && action !== "remove") {
    return res.status(400).json({ error: "action must be add or remove" });
  }

  if (action === "add") {
    const existing = db.prepare("SELECT id FROM watchlist_items WHERE watchlist_id=? AND ticker=?").get(id, t);
    if (existing) return res.json({ ok: true, ticker: t });

    db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(id, t);
    // Snapshot the fair value the user is acting on. Cached financials land before the
    // response; a cache miss finishes in the background so the add never waits on FMP.
    const { snapshot } = snapshotFairValueOnAdd({
      db,
      watchlistId: id,
      ticker: t,
      apiKey: fmpApiKey(),
      financialsStore: fmpFinancialsStore,
    });
    return res.json({ ok: true, ticker: t, fairValueAtAdd: snapshot });
  }

  db.prepare("DELETE FROM watchlist_items WHERE watchlist_id=? AND ticker=?").run(id, t);
  return res.json({ ok: true, ticker: t });
});
app.delete("/api/watchlists/:id", requireGoogleAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const list = db.prepare("SELECT * FROM watchlists WHERE id=? AND user_id=?").get(id, req.user.id);
  if (!list) return res.status(404).json({ error: "Not found" });
  db.prepare("DELETE FROM watchlist_items WHERE watchlist_id=?").run(id);
  db.prepare("DELETE FROM watchlists WHERE id=?").run(id);
  res.json({ ok: true });
});

// Social
app.post("/api/users/:handle/follow", requireAuth, (req, res) => {
  const { handle } = req.params;
  const target = db.prepare("SELECT id FROM users WHERE handle=?").get(handle);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === req.user.id) return res.status(400).json({ error: "Cannot follow yourself" });
  const existing = db.prepare("SELECT id FROM user_follows WHERE follower_id=? AND following_id=?").get(req.user.id, target.id);
  if (existing) {
    db.prepare("DELETE FROM user_follows WHERE id=?").run(existing.id);
    res.json({ following: false });
  } else {
    db.prepare("INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)").run(req.user.id, target.id);
    res.json({ following: true });
  }
});
app.get("/api/feed", requireAuth, (req, res) => {
  const following = db.prepare("SELECT following_id FROM user_follows WHERE follower_id=?").all(req.user.id);
  const ids = following.map((f) => f.following_id);
  if (ids.length === 0) return res.json({ items: [] });
  const placeholders = ids.map(() => "?").join(",");
  // Fair-value changes are personal notifications (and can name a private watchlist),
  // so they stay out of followers' feeds and are only served by /api/activity/me.
  const rows = db.prepare(
    `SELECT * FROM activity_log WHERE user_id IN (${placeholders})
       AND type <> 'watchlist_fv_change'
     ORDER BY created_at DESC LIMIT 50`
  ).all(...ids);
  res.json({ items: rows });
});
// ── Financial Modeling Prep (stable API) ─────────────────────────────────────
const FMP_FINANCIALS_DIR = resolveFmpFinancialsDir();
const fmpFinancialsStore = createFinancialsStore(FMP_FINANCIALS_DIR);
console.log(`[fmp] Per-ticker financials cache directory: ${FMP_FINANCIALS_DIR}`);

const SCREENER_DIR = resolveScreenerDir();
const screenerStore = createScreenerStore(SCREENER_DIR);
console.log(`[screener] Data directory: ${SCREENER_DIR}`);

let screenerRebuildPromise = null;

const _fmpCache = new Map();
function cachedFmp(key, ttlMs, fn) {
  const hit = _fmpCache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data);
  return fn().then((data) => {
    _fmpCache.set(key, { data, ts: Date.now() });
    return data;
  });
}

/** Symbol from ?symbol= (preferred for tickers like 7203.T) or legacy path segment. */
function fmpSymbolFromRequest(req) {
  const fromQuery = String(req.query?.symbol || "").trim();
  if (fromQuery) return fromQuery;
  const seg = req.params?.symbol;
  if (seg != null && String(seg).trim() !== "") return decodeURIComponent(String(seg));
  return "";
}

function mapFmpProfileRow(raw, requestSymbol) {
  if (!raw || typeof raw !== "object") return null;
  const logoUrl = resolveFmpLogoUrl(raw, requestSymbol);
  return {
    symbol: raw.symbol ?? null,
    name: raw.companyName ?? raw.name ?? null,
    industry: raw.industry ?? null,
    sector: raw.sector ?? null,
    description: raw.description ?? null,
    city: raw.city ?? null,
    country: raw.country ?? null,
    CEO: raw.ceo ?? null,
    website: raw.website ?? null,
    phone: raw.phone ?? null,
    logoUrl,
  };
}

app.get(["/api/fmp/profile", "/api/fmp/profile/:symbol"], async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const symbol = fmpSymbolFromRequest(req);
  if (!symbol) return res.status(400).json({ error: "symbol query parameter required" });
  try {
    const data = await cachedFmp(`fmp:profile:v2:${symbol}`, 6 * 3600_000, async () => {
      const url = `${FMP_STABLE_BASE}/profile?${new URLSearchParams({ symbol, apikey: key })}`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(`FMP profile HTTP ${r.status}`);
      let arr;
      try {
        arr = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("FMP profile: invalid JSON");
      }
      if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
        throw new Error(String(arr["Error Message"] || arr.error));
      }
      const row = Array.isArray(arr) ? arr[0] : arr;
      if (!row || typeof row !== "object") throw new Error("FMP profile: empty");
      const mapped = mapFmpProfileRow(row, symbol);
      if (!mapped) throw new Error("FMP profile: map failed");
      return mapped;
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/profile]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get(["/api/fmp/quote", "/api/fmp/quote/:symbol"], async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const symbol = fmpSymbolFromRequest(req);
  if (!symbol) return res.status(400).json({ error: "symbol query parameter required" });
  try {
    const data = await cachedFmp(`fmp:quote:${symbol}`, 60_000, async () => {
      const url = `${FMP_STABLE_BASE}/quote?${new URLSearchParams({ symbol, apikey: key })}`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(`FMP quote HTTP ${r.status}`);
      let arr;
      try {
        arr = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("FMP quote: invalid JSON");
      }
      if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
        throw new Error(String(arr["Error Message"] || arr.error));
      }
      const row = Array.isArray(arr) ? arr[0] : arr;
      if (!row || typeof row !== "object") throw new Error("FMP quote: empty");
      const p = Number(row.price);
      if (!Number.isFinite(p)) throw new Error("FMP quote: invalid price");
      return { price: p, currency: row.currency ?? null };
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/quote]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});

/** Market index quotes for the global topbar ticker (FMP stable quote-short). */
const TOPBAR_INDEX_SYMBOLS = ["^SPX", "^NDX", "^DJI", "^FTSE", "^TASI.SR"];

app.get("/api/fmp/index-quotes", async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  try {
    const data = await cachedFmp("fmp:index-quotes", 15 * 60_000, async () => {
      const rows = await Promise.all(
        TOPBAR_INDEX_SYMBOLS.map(async (symbol) => {
          try {
            const url = `${FMP_STABLE_BASE}/quote-short?${new URLSearchParams({ symbol, apikey: key })}`;
            const r = await fetch(url);
            const text = await r.text();
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const arr = text ? JSON.parse(text) : null;
            const row = Array.isArray(arr) ? arr[0] : arr;
            const price = Number(row?.price);
            if (!Number.isFinite(price)) throw new Error("empty");
            const change = Number(row?.change);
            const prevClose = price - (Number.isFinite(change) ? change : 0);
            const changePct =
              Number.isFinite(change) && prevClose !== 0 ? (change / prevClose) * 100 : null;
            return {
              symbol,
              price,
              change: Number.isFinite(change) ? change : null,
              changePct,
            };
          } catch {
            return { symbol, price: null, change: null, changePct: null };
          }
        })
      );
      return rows;
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/index-quotes]", err.message);
    res.status(502).json({ error: err.message });
  }
});

/** Key metrics (valuation, returns, health) — FMP stable key-metrics. */
app.get(["/api/fmp/key-metrics", "/api/fmp/key-metrics/:symbol"], async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const symbol = fmpSymbolFromRequest(req);
  if (!symbol) return res.status(400).json({ error: "symbol query parameter required" });
  const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 5, 1), 10);
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  try {
    const data = await cachedFmp(`fmp:key-metrics:${symbol}:${limit}`, 6 * 3600_000, async () => {
      const url = `${FMP_STABLE_BASE}/key-metrics?${new URLSearchParams({
        symbol,
        limit: String(limit),
        apikey: key,
      })}`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(`FMP key-metrics HTTP ${r.status}`);
      let arr;
      try {
        arr = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("FMP key-metrics: invalid JSON");
      }
      if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
        throw new Error(String(arr["Error Message"] || arr.error));
      }
      if (!Array.isArray(arr)) throw new Error("FMP key-metrics: empty");
      return arr.map((row) => ({
        fiscalYear: row.fiscalYear ?? null,
        date: row.date ?? null,
        period: row.period ?? null,
        reportedCurrency: row.reportedCurrency ?? null,
        marketCap: toNum(row.marketCap),
        enterpriseValue: toNum(row.enterpriseValue),
        evToSales: toNum(row.evToSales),
        evToEBITDA: toNum(row.evToEBITDA),
        evToFreeCashFlow: toNum(row.evToFreeCashFlow),
        netDebtToEBITDA: toNum(row.netDebtToEBITDA),
        currentRatio: toNum(row.currentRatio),
        earningsYield: toNum(row.earningsYield),
        freeCashFlowYield: toNum(row.freeCashFlowYield),
        returnOnEquity: toNum(row.returnOnEquity),
        returnOnAssets: toNum(row.returnOnAssets),
        returnOnInvestedCapital: toNum(row.returnOnInvestedCapital),
        returnOnCapitalEmployed: toNum(row.returnOnCapitalEmployed),
        grahamNumber: toNum(row.grahamNumber),
        workingCapital: toNum(row.workingCapital),
        investedCapital: toNum(row.investedCapital),
        freeCashFlowToEquity: toNum(row.freeCashFlowToEquity),
        incomeQuality: toNum(row.incomeQuality),
        daysOfSalesOutstanding: toNum(row.daysOfSalesOutstanding),
        daysOfInventoryOutstanding: toNum(row.daysOfInventoryOutstanding),
        daysOfPayablesOutstanding: toNum(row.daysOfPayablesOutstanding),
        cashConversionCycle: toNum(row.cashConversionCycle),
      }));
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/key-metrics]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});

/** DCF fair value — full figure only for signed-in users (FMP stable discounted-cash-flow). */
app.get(["/api/fmp/dcf", "/api/fmp/dcf/:symbol"], async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const symbol = fmpSymbolFromRequest(req);
  if (!symbol) return res.status(400).json({ error: "symbol query parameter required" });
  const market = String(req.query?.market ?? "").trim().toLowerCase();
  const candidates = dcfSymbolCandidates(symbol, market);
  try {
    const row = await cachedFmp(`fmp:dcf:${candidates.join("|")}`, 60 * 60_000, async () => {
      return fetchDcfWithFallback(candidates.length ? candidates : [symbol], key);
    });

    if (!req.user) {
      return res.json({
        locked: true,
        symbol: row.symbol,
        date: row.date,
        stockPrice: row.stockPrice,
        hasDcf: true,
      });
    }

    const stockPrice = row.stockPrice;
    let discountPct = null;
    if (Number.isFinite(stockPrice) && stockPrice > 0) {
      discountPct = Math.round(((row.dcf - stockPrice) / stockPrice) * 1000) / 10;
    }

    res.json({
      locked: false,
      symbol: row.symbol,
      date: row.date,
      dcf: row.dcf,
      stockPrice,
      discountPct,
    });
  } catch (err) {
    const msg = String(err?.message || err);
    console.error("[fmp/dcf]", candidates.join(","), msg);
    const noData =
      /empty|missing dcf|invalid json/i.test(msg) ||
      msg.startsWith("FMP DCF:");
    if (noData) {
      return res.json({
        locked: !req.user,
        symbol,
        date: null,
        stockPrice: null,
        hasDcf: false,
      });
    }
    res.status(502).json({ error: msg });
  }
});

/** Yearly EV fair value + monthly price history for the DCF hero chart. */
app.get(["/api/fmp/fair-value-chart", "/api/fmp/fair-value-chart/:symbol"], async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const symbol = fmpSymbolFromRequest(req);
  if (!symbol) return res.status(400).json({ error: "symbol query parameter required" });
  try {
    const data = await cachedFmp(`fmp:fv-chart:v2:${symbol}`, 6 * 3600_000, async () => {
      return fetchFairValueChartData(symbol, key);
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/fair-value-chart]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});

async function fetchFmpStableArray(path, params, label) {
  const key = fmpApiKey();
  if (!key) throw new Error("FMP_API_KEY not configured");
  const url = `${FMP_STABLE_BASE}/${path}?${new URLSearchParams({ ...params, apikey: key })}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`FMP ${label} HTTP ${r.status}`);
  let arr;
  try {
    arr = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`FMP ${label}: invalid JSON`);
  }
  if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
    throw new Error(String(arr["Error Message"] || arr.error));
  }
  if (!Array.isArray(arr)) throw new Error(`FMP ${label}: expected array`);
  return arr;
}

function normalizeSnapshotDate(raw) {
  const s = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

app.get("/api/fmp/sa-market-dashboard", async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const cacheKey = "fmp:sa-market:live";
  try {
    const data = await cachedFmp(cacheKey, 10 * 60_000, async () => buildSaMarketDashboard(key));
    res.json(data);
  } catch (err) {
    console.error("[fmp/sa-market-dashboard]", err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/fmp/us-market-universe", async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  try {
    const data = await cachedFmp("fmp:us-universe", MARKET_UNIVERSE_TTL_MS, () =>
      getMarketUniverse("us", key, buildUsMarketUniverse)
    );
    res.json(data);
  } catch (err) {
    console.error("[fmp/us-market-universe]", err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/fmp/sa-market-universe", async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  try {
    const data = await cachedFmp("fmp:sa-universe", MARKET_UNIVERSE_TTL_MS, () =>
      getMarketUniverse("sa", key, buildSaMarketUniverse)
    );
    res.json(data);
  } catch (err) {
    console.error("[fmp/sa-market-universe]", err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/fmp/home-signals", async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  try {
    const data = await cachedFmp("fmp:home-signals", HOME_SIGNALS_TTL_MS, async () => {
      return getHomeSignals(async () => {
        const snap = readScreenerSnapshot();
        return buildHomeSignals(key, {
          usItems: snap.us?.items || [],
          saItems: snap.sa?.items || [],
        });
      });
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/home-signals]", err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/fmp/us-market-dashboard", async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const date = normalizeSnapshotDate(req.query?.date);
  const cacheKey = `fmp:us-market:${date}`;
  try {
    const data = await cachedFmp(cacheKey, 10 * 60_000, async () => {
      const [sectors, industries, gainers, losers, mostActives] = await Promise.all([
        fetchFmpStableArray(
          "sector-performance-snapshot",
          { date },
          "sector-performance"
        ),
        fetchFmpStableArray(
          "industry-performance-snapshot",
          { date },
          "industry-performance"
        ),
        fetchFmpStableArray("biggest-gainers", {}, "biggest-gainers"),
        fetchFmpStableArray("biggest-losers", {}, "biggest-losers"),
        fetchFmpStableArray("most-actives", {}, "most-actives"),
      ]);

      const mapMover = (row) => ({
        symbol: row?.symbol ?? "",
        name: row?.name ?? "",
        price: Number(row?.price),
        change: Number(row?.change),
        changesPercentage: Number(row?.changesPercentage),
        exchange: row?.exchange ?? "",
      });

      return {
        date,
        sectors: sectors.map((row) => ({
          sector: row?.sector ?? "",
          exchange: row?.exchange ?? "",
          averageChange: Number(row?.averageChange),
        })),
        industries: industries.map((row) => ({
          industry: row?.industry ?? "",
          exchange: row?.exchange ?? "",
          averageChange: Number(row?.averageChange),
        })),
        gainers: gainers.map(mapMover).filter((r) => r.symbol),
        losers: losers.map(mapMover).filter((r) => r.symbol),
        mostActives: mostActives.map(mapMover).filter((r) => r.symbol),
      };
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/us-market-dashboard]", date, err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/fmp/news/general-latest", async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const page = Math.max(0, Number.parseInt(String(req.query?.page ?? "0"), 10) || 0);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query?.limit ?? "20"), 10) || 20));
  const cacheKey = `fmp:news:general:${page}:${limit}`;
  try {
    const data = await cachedFmp(cacheKey, 5 * 60_000, async () => {
      const url = `${FMP_STABLE_BASE}/news/general-latest?${new URLSearchParams({
        page: String(page),
        limit: String(limit),
        apikey: key,
      })}`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(`FMP news HTTP ${r.status}`);
      let arr;
      try {
        arr = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("FMP news: invalid JSON");
      }
      if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
        throw new Error(String(arr["Error Message"] || arr.error));
      }
      if (!Array.isArray(arr)) throw new Error("FMP news: expected array");
      return arr.map((row) => ({
        title: row?.title ?? "",
        url: row?.url ?? "",
        publisher: row?.publisher ?? row?.site ?? "",
        publishedDate: row?.publishedDate ?? null,
        image: typeof row?.image === "string" ? row.image : null,
        symbol: row?.symbol ?? null,
      }));
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/news/general-latest]", err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get(["/api/fmp/news/stock", "/api/fmp/news/stock/:symbol"], async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const symbol = fmpSymbolFromRequest(req);
  if (!symbol) return res.status(400).json({ error: "symbol query parameter required" });
  const cacheKey = `fmp:news:stock:${symbol.toUpperCase()}`;
  try {
    const data = await cachedFmp(cacheKey, 5 * 60_000, async () => {
      const url = `${FMP_STABLE_BASE}/news/stock?${new URLSearchParams({
        symbols: symbol,
        apikey: key,
      })}`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(`FMP stock news HTTP ${r.status}`);
      let arr;
      try {
        arr = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("FMP stock news: invalid JSON");
      }
      if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
        throw new Error(String(arr["Error Message"] || arr.error));
      }
      if (!Array.isArray(arr)) throw new Error("FMP stock news: expected array");
      return arr.map((row) => ({
        title: row?.title ?? "",
        url: row?.url ?? "",
        publisher: row?.publisher ?? row?.site ?? "",
        publishedDate: row?.publishedDate ?? null,
        image: typeof row?.image === "string" ? row.image : null,
        symbol: row?.symbol ?? symbol,
        text: typeof row?.text === "string" ? row.text : null,
      }));
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/news/stock]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get(["/api/fmp/ratios", "/api/fmp/ratios/:symbol"], async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const symbol = fmpSymbolFromRequest(req);
  if (!symbol) return res.status(400).json({ error: "symbol query parameter required" });
  try {
    const data = await cachedFmp(`fmp:ratios:${symbol}`, 6 * 3600_000, async () => {
      const url = `${FMP_STABLE_BASE}/ratios?${new URLSearchParams({ symbol, apikey: key })}`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(`FMP ratios HTTP ${r.status}`);
      let arr;
      try {
        arr = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("FMP ratios: invalid JSON");
      }
      if (arr && typeof arr === "object" && !Array.isArray(arr) && (arr["Error Message"] || arr.error)) {
        throw new Error(String(arr["Error Message"] || arr.error));
      }
      if (!Array.isArray(arr) || !arr.length) throw new Error("FMP ratios: empty");
      const row = arr[0];
      const pe = Number(row.priceToEarningsRatio);
      const ps = Number(row.priceToSalesRatio);
      return {
        symbol: row.symbol ?? symbol,
        date: row.date ?? null,
        fiscalYear: row.fiscalYear ?? null,
        priceToEarningsRatio: Number.isFinite(pe) ? pe : null,
        priceToSalesRatio: Number.isFinite(ps) ? ps : null,
      };
    });
    res.json(data);
  } catch (err) {
    console.error("[fmp/ratios]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get(["/api/fmp/financials", "/api/fmp/financials/:symbol"], async (req, res) => {
  const key = fmpApiKey();
  if (!key) return res.status(503).json({ error: "FMP_API_KEY not configured" });
  const symbol = fmpSymbolFromRequest(req);
  if (!symbol) return res.status(400).json({ error: "symbol query parameter required" });
  const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";

  try {
    if (!forceRefresh) {
      const cached = fmpFinancialsStore.readRecord(symbol);
      if (cached?.record && !fmpFinancialsStore.isExpired(cached.record)) {
        console.log(`[fmp/financials] disk hit ${symbol} -> ${cached.path}`);
        return res.json(fmpFinancialsStore.toResponse(cached.record, "disk"));
      }
    }

    const bundle = await fetchFmpFinancialsBundle(symbol, key);

    if (bundle.fetchErrors?.length) {
      const issues = bundle.fetchErrors.map((e) => `fetch_failed_${e}`);
      console.warn(`[fmp/financials] incomplete ${symbol} (fetch):`, issues.join(", "));
      return res.status(422).json({
        error: INCOMPLETE_USER_MESSAGE,
        code: INCOMPLETE_DATA_CODE,
        retry: true,
        issues,
      });
    }

    const validation = validateFmpFinancialsBundle(bundle);
    if (!validation.ok) {
      console.warn(`[fmp/financials] incomplete ${symbol} (validation):`, validation.issues.join(", "));
      return res.status(422).json({
        error: INCOMPLETE_USER_MESSAGE,
        code: INCOMPLETE_DATA_CODE,
        retry: true,
        issues: validation.issues,
      });
    }

    const saved = fmpFinancialsStore.writeRecord(symbol, bundle.companyName, bundle);
    console.log(
      `[fmp/financials] saved ${symbol} (${bundle.companyName || "no name"}) -> ${saved.filePath || FMP_FINANCIALS_DIR}`
    );
    res.json(fmpFinancialsStore.toResponse(saved, "fmp"));
  } catch (err) {
    console.error("[fmp/financials]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});

function mergeScreenerResponse(rowsByMarket, meta) {
  const items = SCREENER_MARKETS
    .flatMap((m) => rowsByMarket?.[m] || [])
    .filter(isUsableScreenerRow);
  const sectors = Array.from(new Set(items.map((x) => x.sector).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  return { items, sectors, meta };
}

function scheduleScreenerRebuildIfNeeded(needed) {
  if (!needed) return;
  const key = fmpApiKey();
  if (!key) {
    console.warn("[screener] skip rebuild: FMP_API_KEY not configured");
    return;
  }
  if (screenerRebuildPromise) return;
  const delayMs = Number(process.env.SCREENER_FMP_DELAY_MS || 350);
  console.log(`[screener] starting background FMP rebuild (${SCREENER_MARKETS.map((m) => m.toUpperCase()).join(" + ")})…`);
  screenerRebuildPromise = buildAllScreeners({
    apiKey: key,
    financialsStore: fmpFinancialsStore,
    screenerStore,
    delayMs,
  })
    .then(() => console.log("[screener] background rebuild finished"))
    .catch((err) => console.error("[screener] background rebuild failed:", err.message))
    .finally(() => {
      screenerRebuildPromise = null;
    });
}

function readScreenerSnapshot() {
  const snapshot = {};
  for (const m of SCREENER_MARKETS) {
    const hit = screenerStore.read(m);
    const items = hit?.record?.items;
    const expired = !hit?.record || screenerStore.isExpired(hit.record);
    snapshot[m] = {
      hit,
      items: items || [],
      meta: hit?.record?.meta || null,
      expired,
      usable: screenerMarketUsable(items),
    };
  }
  return snapshot;
}

function ensureScreenerCacheWarm() {
  const snap = readScreenerSnapshot();
  const needs = SCREENER_MARKETS.some((m) => !snap[m].usable || snap[m].expired);
  if (needs) {
    console.log("[screener] FMP cache missing, expired, or incomplete — scheduling build");
    scheduleScreenerRebuildIfNeeded(true);
  }
}

let stocksCatalogCache = null;
app.get("/api/catalog", (req, res) => {
  try {
    if (!stocksCatalogCache) {
      stocksCatalogCache = buildStocksCatalogPayload();
      console.log(
        `[catalog] loaded ${stocksCatalogCache.total} tickers (US ${stocksCatalogCache.markets.us?.count || 0}, SA ${stocksCatalogCache.markets.sa?.count || 0}, JP ${stocksCatalogCache.markets.jp?.count || 0}, UK ${stocksCatalogCache.markets.uk?.count || 0})`
      );
    }
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(stocksCatalogCache);
  } catch (err) {
    console.error("[catalog]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/screener", (req, res) => {
  try {
    const snap = readScreenerSnapshot();
    const force = req.query.refresh === "1" || req.query.refresh === "true";

    if (force) scheduleScreenerRebuildIfNeeded(true);

    const anyUsable = SCREENER_MARKETS.some((m) => snap[m].usable);
    const anyData = SCREENER_MARKETS.some((m) => snap[m].items.length);

    if (anyUsable) {
      const stale =
        force ||
        SCREENER_MARKETS.some((m) => snap[m].expired || !snap[m].usable);
      if (stale) scheduleScreenerRebuildIfNeeded(true);

      const rowsByMarket = Object.fromEntries(
        SCREENER_MARKETS.map((m) => [m, snap[m].items || []])
      );
      const metaByMarket = Object.fromEntries(
        SCREENER_MARKETS.map((m) => [m, snap[m].meta])
      );

      return res.json(
        mergeScreenerResponse(rowsByMarket, {
          source: stale ? "disk-stale" : "disk",
          stale,
          markets: metaByMarket,
          rebuilding: Boolean(screenerRebuildPromise),
        })
      );
    }

    if (anyData) {
      console.warn("[screener] disk cache has incomplete metrics; rebuilding from FMP");
    }
    scheduleScreenerRebuildIfNeeded(true);

    return res.status(503).json({
      error: "Screener data is being built from FMP. Please try again in a few minutes.",
      rebuilding: Boolean(screenerRebuildPromise),
    });
  } catch (err) {
    console.error("[screener]", err.message);
    res.status(500).json({ error: err.message });
  }
});
// ── End Financial Modeling Prep ───────────────────────────────────────────────

app.get("/api/analytics/trending", (req, res) => {
  const rows = db.prepare(
    `SELECT ticker, COUNT(*) as views FROM activity_log
     WHERE type='view' AND ticker IS NOT NULL AND created_at > datetime('now', '-7 days')
     GROUP BY ticker ORDER BY views DESC LIMIT 10`
  ).all();
  res.json({ trending: rows });
});

/** Per-route canonical injection so non-JS crawlers don't see the homepage canonical on every page. */
const CANONICAL_SITE = `https://${CANONICAL_HOST}`;
configureSeoSiteUrl(CANONICAL_SITE);
let _spaIndexTemplate = null;
let _spaIndexTemplatePath = "";

function loadSpaIndexTemplate(indexHtmlPath) {
  if (_spaIndexTemplate === null || _spaIndexTemplatePath !== indexHtmlPath) {
    _spaIndexTemplate = readFileSync(indexHtmlPath, "utf8");
    _spaIndexTemplatePath = indexHtmlPath;
  }
  return _spaIndexTemplate;
}

function canonicalUrlForPath(reqPath) {
  let path = String(reqPath || "/").split("?")[0];
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (!path) path = "/";
  return path === "/" ? `${CANONICAL_SITE}/` : `${CANONICAL_SITE}${path}`;
}

function renderSpaIndexHtml(indexHtmlPath, canonical, seoInject = null) {
  const html = loadSpaIndexTemplate(indexHtmlPath);
  if (seoInject?.seo) {
    return injectSeoIntoSpaHtml(html, seoInject.seo, CANONICAL_SITE, canonical, {
      staticFallbackHtml: seoInject.staticFallbackHtml,
    });
  }
  return html
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/i, `$1${canonical}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/?>)/i, `$1${canonical}$2`);
}

function stockSeoInjectForRequest(req) {
  const stockMatch = String(req.path || "").match(/^\/stock\/([^/]+)\/?$/);
  if (!stockMatch) return null;
  try {
    const rawTicker = decodeURIComponent(stockMatch[1]);
    const lang = req.query.lang === "ar" ? "ar" : "en";
    const found = findStockByTicker(rawTicker);
    if (!found) return null;
    const seo = buildStockSeo({
      ticker: found.hit.ticker,
      companyName: found.hit.name,
      lang,
      market: found.market,
      currency: CURRENCY_BY_MARKET[found.market],
    });
    return {
      seo,
      staticFallbackHtml: buildStockStaticFallback({
        hit: found.hit,
        market: found.market,
        lang,
        seo,
        currency: CURRENCY_BY_MARKET[found.market],
      }),
    };
  } catch (err) {
    console.warn("[static] stock SEO lookup failed:", err?.message || err);
    return null;
  }
}

function tutorialSeoInjectForRequest(req) {
  const parsed = parseTutorialPath(req.path);
  if (!parsed) return null;
  try {
    const { locale, slug } = parsed;
    if (slug) {
      const base = TUTORIAL_BY_SLUG[slug];
      if (!base) return null;
      const article = resolveTutorialArticle(base, locale, TUTORIAL_ARTICLES);
      if (!article) return null;
      const seo = buildTutorialArticleSeo({ article, lang: locale });
      return {
        seo,
        staticFallbackHtml: buildTutorialSpaStaticFallback({ locale, article }),
      };
    }
    const articles = resolveTutorialArticles(TUTORIAL_ARTICLES, locale);
    const seo = buildTutorialsIndexSeo({ articles, lang: locale });
    return {
      seo,
      staticFallbackHtml: buildTutorialSpaStaticFallback({ locale, articles, indexSeo: seo }),
    };
  } catch (err) {
    console.warn("[static] tutorial SEO lookup failed:", err?.message || err);
    return null;
  }
}

function trySendTutorialStatic(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const parsed = parseTutorialPath(req.path);
  if (!parsed) return next();
  const file = parsed.slug
    ? join(staticPath, parsed.locale, "tutorials", `${parsed.slug}.html`)
    : join(staticPath, parsed.locale, "tutorials", "index.html");
  if (!existsSync(file)) return next();
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.sendFile(file, (err) => {
    if (err) next(err);
  });
}

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth")) return next();
  // Missing hashed files must not fall through to SPA HTML (wrong MIME / confusing errors).
  if (req.path.startsWith("/assets")) {
    return res.status(404).type("text/plain").send("Not found");
  }
  trySendTutorialStatic(req, res, () => {
  const knownRoutePatterns = [
    /^\/$/,
    /^\/about\/?$/,
    /^\/methodology\/?$/,
    /^\/blogs\/?$/,
    /^\/(en|ar)\/tutorials\/?$/,
    /^\/(en|ar)\/tutorials\/[^/]+\/?$/,
    /^\/tutorials\/?$/,
    /^\/tutorials\/[^/]+\/?$/,
    /^\/contact\/?$/,
    /^\/profile\/?$/,
    /^\/profile\/setup\/?$/,
    /^\/profile\/[^/]+\/?$/,
    /^\/stock\/[^/]+\/?$/,
    /^\/us-markets\/?$/,
    /^\/sa-markets\/?$/,
  ];
  const isKnownSpaRoute = knownRoutePatterns.some((re) => re.test(req.path));
  const indexHtml = join(staticPath, "index.html");
  if (!existsSync(indexHtml)) {
    return res.status(503).type("text/plain").send("Client build missing. Run npm run build at repo root.");
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  if (!isKnownSpaRoute) {
    res.status(404);
  }
  try {
    const canonical = isKnownSpaRoute ? canonicalUrlForPath(req.path) : `${CANONICAL_SITE}/`;
    const seoInject = isKnownSpaRoute
      ? tutorialSeoInjectForRequest(req) || stockSeoInjectForRequest(req)
      : null;
    const html = renderSpaIndexHtml(indexHtml, canonical, seoInject);
    res.type("html").send(html);
  } catch (err) {
    console.error("[static] render index.html failed:", err.message);
    res.sendFile(indexHtml, (e) => {
      if (e) {
        console.error("[static] sendFile index.html failed:", e.message);
        next(e);
      }
    });
  }
  });
});

// Avoid Express default HTML error pages (wrong MIME for /assets debugging).
app.use((err, req, res, next) => {
  console.error("[express]", err?.message || err);
  if (res.headersSent) return next(err);
  res.status(500).type("text/plain").send("Internal Server Error");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at ${SERVER_URL}`);
  console.log(`Client: ${CLIENT_URL}`);
  ensureScreenerCacheWarm();
  try {
    getCatalogPools();
  } catch (e) {
    console.warn("[seo] pool warm failed:", e?.message || e);
  }
  startWatchlistFairValueCron({
    db,
    financialsStore: fmpFinancialsStore,
    apiKeyFn: fmpApiKey,
    delayMs: Number(process.env.WATCHLIST_FV_DELAY_MS || 350),
  });
  startFairValueEmailCron({
    db,
    siteUrl: CLIENT_URL,
    apiUrl: SERVER_URL,
    delayMs: Number(process.env.EMAIL_SEND_DELAY_MS || 400),
  });
});
