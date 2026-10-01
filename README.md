# ServerSide

Stocks financials web app (Vite + React). The production build is written to `server/static/` and served by Express on Render.

## Local development vs production (two processes)

**On your machine (two terminals):**

| What | Role | Typical command |
|------|------|-----------------|
| **Client** | Vite dev server: React, hot reload, serves `index.html` and proxies dev assets | `npm run dev` → often **http://localhost:5173** |
| **Server** | Express in `server/`: REST API, Google OAuth, sessions, SQLite, comments, watchlists | `npm run server` or `cd server && npm run dev` → often **http://localhost:3001** |

The browser loads the UI from **5173** and the React app calls the API using **`VITE_API_URL`** (e.g. `http://localhost:3001`). That is **two separate programs** talking over HTTP.

**In production, the site is one Render service** ([`render.yaml`](render.yaml)):

- The build runs `npm run build`, which writes the client to **`server/static/`**.
- Express serves that folder and the API from the same origin.

A split setup (static host for the UI, separate host for the API) is optional. If you use one, set **`VITE_API_URL`** to the API’s HTTPS base URL. The deployed site at trueprice.cash does not use that split, and it does not use Vercel.

**Google sign-in on Cloudflare Pages / Vercel:** The “Sign in with Google” button must open your **deployed API** (`/auth/google` on Express), not the static site. Set **`VITE_API_URL`** in the frontend project to that API’s HTTPS origin (even if you later use a single Node server for both UI and API, set it to the same public URL). Redeploy the frontend after adding it. Without this, the app cannot start OAuth.

## Deploy the API (fixes “Sign-in needs the API server” on Cloudflare)

The repo includes a root **`Dockerfile`** that builds the client and runs **`server/server.js`**. Deploy it to **Render**, **Railway**, or any Docker host.

### 1. Create the API service

- **Render:** New **Web Service** → connect **ServerSide** → **Docker** → use repo root `Dockerfile`. Or use [`render.yaml`](render.yaml) (Blueprint).
- **Railway:** New project → **Deploy from GitHub** → pick repo → Railway detects `Dockerfile`.

### 2. Runtime environment variables (on the API host)

| Variable | Example | Purpose |
|----------|---------|---------|
| `CLIENT_URL` | `https://your-app.pages.dev` | Your **Cloudflare Pages** site URL (OAuth redirect back). |
| `SERVER_URL` | `https://trueprice-api.onrender.com` | **Public HTTPS URL of this API** (must match the service URL). |
| `DB_PATH` | `/var/data/trueprice.db` | SQLite file path. Use a persistent disk path in production. |
| `SESSION_SECRET` | long random string | Session encryption. |
| `REDIS_URL` | `redis://default:password@host:port` | Persistent session store (recommended: Render Key Value / Upstash). |
| `CANONICAL_HOST` | `trueprice.cash` | Preferred host for 301 redirects (e.g. redirect `www` -> apex). |
| `SINGLE_SESSION_PER_USER` | `false` | Optional: set `true` to allow only one active session per user. |
| `GOOGLE_CLIENT_ID` | from Google Cloud | OAuth. |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud | OAuth. |

`PORT` is usually injected by the host; the server reads `process.env.PORT`.

For Render + SQLite durability, mount a persistent disk and set `DB_PATH=/var/data/trueprice.db`; otherwise SQLite resets on restarts/redeploys.

### 3. Docker build arguments (optional but recommended)

When building the image, pass the same **`VITE_*`** values you use on Cloudflare and set **`VITE_API_URL`** to the **same public URL as `SERVER_URL`**, so the copy of the app inside the container stays consistent. **Cloudflare** still needs its own env vars for the copy of the site users load from Pages. Set **`FMP_API_KEY`** on the API host for live quotes and profiles.

### 4. Google Cloud Console (OAuth client)

- **Authorized JavaScript origins:** your Cloudflare origin (`https://….pages.dev` or custom domain).
- **Authorized redirect URIs:** `https://<YOUR_SERVER_URL_HOST>/auth/google/callback` (exactly `SERVER_URL` + `/auth/google/callback`).

### 5. Cloudflare Pages (frontend)

Tell the browser where the API is (pick one):

- **A)** **Environment variables** (recommended): **`VITE_API_URL`** = same value as **`SERVER_URL`**. **Save** and **Redeploy** (required — Vite reads env at **build** time).
- **B)** If you still see the sign-in banner after redeploying: edit **`public/runtime-config.js`** in GitHub, set  
  `window.__TP_PUBLIC_API_URL__ = "https://your-api-host"` (your public API URL), commit, and let Pages rebuild. No Cloudflare env var needed for that path.

After the API is live and one of the above is set, Google sign-in will use your API.

## Deploy on Cloudflare Pages (instead of Vercel)

1. **Account** — Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free tier is enough).

2. **Create a Pages project** — **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → authorize GitHub and select the **ServerSide** repo.

3. **Build settings** (first screen after picking the repo):
   - **Framework preset:** **Vite** (recommended) or **None**.
   - **Build command:** `npm run build`
   - **Build output directory:** **`server/static`** — must match this repo (`vite.config.mjs`). If this is wrong, the site deploys without JS and shows a **blank page**.
   - **Root directory:** `/` (repo root).
   - Optional: set **Environment variable** `NODE_VERSION` = `20` if the build fails on an old Node image.

4. **Environment variables** — **Settings → Environment variables** (or add during setup). Add the same keys as [`.env.example`](.env.example). Set **`VITE_API_URL`** to your deployed API base URL (HTTPS) if you use auth, comments, or watchlists — not `localhost`.

5. **Deploy** — Save and deploy. The file [`public/_redirects`](public/_redirects) is copied into `server/static/` and tells Pages to serve `index.html` for client-side routes (React Router).

**Blank page after deploy?** In the browser, open **Developer tools → Network**, reload, and check `index.html` and `/assets/*.js`. If JS returns **HTML** instead of JavaScript, fix **Build output directory** to `server/static`. If `index.html` references `/src/main.jsx`, the static deploy did not run `npm run build` or pointed at the wrong folder.

**`Output directory "server/static" not found`?**  
1) **Settings → Builds:** **Build command** = `npm run build` or `npx vite build` (not empty). **Build output directory** = `server/static`. **Root directory** = `/` (repo root, not `server/`).  
2) Deploy the **latest** `main` — if the log shows `HEAD is now at` an old commit, reconnect the branch or **Create deployment** from the newest commit.  
3) `vite.config.mjs` writes the client to `server/static`. A small plugin copies a legacy `output/` folder there only when the build itself produced nothing.

6. **Custom domain** (optional) — **Custom domains** in the Pages project → add your domain and follow DNS instructions.

7. **Vercel** — This repo no longer includes `vercel.json`. The live site is the Render service. If you use Cloudflare Pages for a frontend copy, the API in `server/` still must be hosted separately; point `VITE_API_URL` at it and update Google OAuth origins for your **Pages** URL.
