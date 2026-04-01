# TruePrice.Cash — Upgrade Complete

The full-stack upgrade from the [UPGRADE_GUIDE.md](c:\Users\MF\Downloads\UPGRADE_GUIDE.md) has been applied.

## What Was Added

### Server (`server/`)
- Express server with SQLite (better-sqlite3)
- Google OAuth (Passport)
- API routes: auth, comments, watchlists, portfolios, activity, analytics
- Database schema in `schema.sql` (auto-created on first run)

### Client Additions
- **AuthContext** — login state, `/auth/me`, login/logout
- **UserBar** — Sign in button / profile menu in header
- **StockComments** — Comments with likes and replies
- **VirtualPortfolio** — Create portfolios, buy/sell virtual trades
- **WatchlistManager** — Create watchlists, add/remove stocks
- **useTrackView** — Auto-logs stock views when signed in

## Quick Start

### 1. Configure Google OAuth
1. Go to https://console.cloud.google.com
2. Create OAuth Client ID (Web application)
3. Add redirect URI: `http://localhost:3001/auth/google/callback`
4. Copy Client ID and Client Secret

### 2. Set Up Server
```bash
cd server
cp .env.example .env
# Edit .env and add your GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET
npm install
```

### 3. Run Locally
```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — Server
npm run server
```

Open http://localhost:5173 — you should see "Sign in with Google" in the header.

### 4. Production Build
```bash
npm run build
cd server
# Update .env: NODE_ENV=production, CLIENT_URL and SERVER_URL to your domain
node server.js
```

## GitHub Pages Note

**GitHub Pages hosts static files only.** This upgrade adds a Node.js backend. To run the full app:

- **Option A:** Deploy the server to a VPS (e.g. DigitalOcean $6/mo) and point your domain there
- **Option B:** Use the frontend alone on GitHub Pages — auth, comments, watchlists, and portfolio will be disabled (graceful fallback when API is unreachable)

The frontend will still work as a static site; social features require the server.
