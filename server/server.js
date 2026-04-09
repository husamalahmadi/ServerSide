import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { validateComment } from "./commentFilter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "trueprice.db");
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

const CLIENT_URL_RAW = process.env.CLIENT_URL || "http://localhost:5173";
/** First origin is used for OAuth redirects; allow comma-separated list for CORS. */
const CLIENT_URL = normalizePublicUrl(CLIENT_URL_RAW.split(",")[0].trim());
const SERVER_URL = normalizePublicUrl(process.env.SERVER_URL || "http://localhost:3001");
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";

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
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
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
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: sessionSameSite,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Auth routes
app.get("/auth/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${CLIENT_URL}/?auth=not_configured`);
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${CLIENT_URL}/?auth=failed` }),
  (req, res) => {
    const needsSetup = req.user && !req.user.profile_completed;
    res.redirect(needsSetup ? `${CLIENT_URL}/profile/setup` : CLIENT_URL);
  }
);
app.get("/auth/me", (req, res) => {
  res.json({ user: req.user || null });
});
app.post("/auth/logout", (req, res) => {
  req.logout(() => {});
  res.json({ ok: true });
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

// User profile: update own profile (picture comes from Google only, not editable)
app.patch("/api/users/me", requireAuth, (req, res) => {
  const { handle, name, bio, dateOfBirth } = req.body || {};
  const updates = ["profile_completed=1", "updated_at=datetime('now')"];
  const params = [];
  if (typeof handle === "string" && handle.trim()) {
    const h = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (h.length >= 3 && h.length <= 30) {
      const existing = db.prepare("SELECT id FROM users WHERE handle=? AND id!=?").get(h, req.user.id);
      if (existing) return res.status(400).json({ error: "Username already taken" });
      updates.push("handle=?");
      params.push(h);
    }
  }
  if (typeof name === "string") { updates.push("name=?"); params.push(name.trim() || null); }
  if (typeof bio === "string") { updates.push("bio=?"); params.push(bio.trim() || null); }
  if (typeof dateOfBirth === "string") { updates.push("date_of_birth=?"); params.push(dateOfBirth.trim() || null); }
  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id=?`).run(...params);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ user });
});

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
  const watchlists = db.prepare(watchlistsSql).all(u.id).map((w) => {
    const items = db
      .prepare("SELECT ticker, created_at FROM watchlist_items WHERE watchlist_id=? ORDER BY datetime(created_at) DESC")
      .all(w.id);
    return {
      ...w,
      items: items.map((i) => ({ ticker: i.ticker, created_at: i.created_at || null })),
    };
  });
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
app.post("/api/comments/:ticker", requireAuth, (req, res) => {
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
app.post("/api/comments/:id/like", requireAuth, (req, res) => {
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
app.delete("/api/comments/:id", requireAuth, (req, res) => {
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
  const withItems = lists.map((l) => {
    const items = db
      .prepare("SELECT ticker, created_at FROM watchlist_items WHERE watchlist_id=? ORDER BY datetime(created_at) DESC")
      .all(l.id);
    return {
      ...l,
      items: items.map((i) => ({ ticker: i.ticker, created_at: i.created_at || null })),
    };
  });
  res.json({ watchlists: withItems });
});
app.get("/api/watchlists/:handle/:slug", (req, res) => {
  const { handle, slug } = req.params;
  const u = db.prepare("SELECT id FROM users WHERE handle=?").get(handle);
  if (!u) return res.status(404).json({ error: "User not found" });
  const list = db.prepare("SELECT * FROM watchlists WHERE user_id=? AND slug=? AND is_public=1").get(u.id, slug);
  if (!list) return res.status(404).json({ error: "Watchlist not found" });
  const items = db
    .prepare("SELECT ticker, created_at FROM watchlist_items WHERE watchlist_id=? ORDER BY datetime(created_at) DESC")
    .all(list.id);
  res.json({
    ...list,
    items: items.map((i) => ({ ticker: i.ticker, created_at: i.created_at || null })),
  });
});
app.post("/api/watchlists", requireAuth, (req, res) => {
  const { name, isPublic = true } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name required" });
  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const stmt = db.prepare("INSERT INTO watchlists (user_id, name, slug, is_public) VALUES (?, ?, ?, ?)");
  stmt.run(req.user.id, name.trim(), slug || "list", isPublic ? 1 : 0);
  const row = db.prepare("SELECT last_insert_rowid() as id").get();
  res.status(201).json({ id: row.id, name: name.trim(), slug: slug || "list", is_public: isPublic ? 1 : 0 });
});
app.put("/api/watchlists/:id/items", requireAuth, (req, res) => {
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
    if (!existing) {
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(id, t);
    }
    return res.json({ ok: true, ticker: t });
  }

  db.prepare("DELETE FROM watchlist_items WHERE watchlist_id=? AND ticker=?").run(id, t);
  return res.json({ ok: true, ticker: t });
});
app.delete("/api/watchlists/:id", requireAuth, (req, res) => {
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
  const rows = db.prepare(
    `SELECT * FROM activity_log WHERE user_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 50`
  ).all(...ids);
  res.json({ items: rows });
});
app.get("/api/analytics/trending", (req, res) => {
  const rows = db.prepare(
    `SELECT ticker, COUNT(*) as views FROM activity_log
     WHERE type='view' AND ticker IS NOT NULL AND created_at > datetime('now', '-7 days')
     GROUP BY ticker ORDER BY views DESC LIMIT 10`
  ).all();
  res.json({ trending: rows });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth")) return next();
  // Missing hashed files must not fall through to SPA HTML (wrong MIME / confusing errors).
  if (req.path.startsWith("/assets")) {
    return res.status(404).type("text/plain").send("Not found");
  }
  const knownRoutePatterns = [
    /^\/$/,
    /^\/about\/?$/,
    /^\/blogs\/?$/,
    /^\/contact\/?$/,
    /^\/profile\/?$/,
    /^\/profile\/setup\/?$/,
    /^\/profile\/[^/]+\/?$/,
    /^\/stock\/[^/]+\/?$/,
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
  res.sendFile(indexHtml, (err) => {
    if (err) {
      console.error("[static] sendFile index.html failed:", err.message);
      next(err);
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
});
