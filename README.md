# ServerSide

Stocks financials web app (Vite + React). The production build is written to `dist/` (Vite default; matches Cloudflare’s Vite preset).

## Local development vs production (two processes)

**On your machine (two terminals):**

| What | Role | Typical command |
|------|------|-----------------|
| **Client** | Vite dev server: React, hot reload, serves `index.html` and proxies dev assets | `npm run dev` → often **http://localhost:5173** |
| **Server** | Express in `server/`: REST API, Google OAuth, sessions, SQLite, comments, watchlists | `npm run server` or `cd server && npm run dev` → often **http://localhost:3001** |

The browser loads the UI from **5173** and the React app calls the API using **`VITE_API_URL`** (e.g. `http://localhost:3001`). That is **two separate programs** talking over HTTP.

**In production, static hosts (Vercel, Cloudflare Pages) only publish the client:**

- They run `npm run build` and upload **`dist/`** (HTML, JS, CSS, `public/` files).
- They **do not** run your Express `server/` — there is no Node process for your API on those platforms unless you add something else (Workers, Functions, etc.).

So production is **not** “the same as localhost with one URL” unless you set it up that way:

1. **Split (common):** Frontend on Vercel / Cloudflare Pages **+** API on **Railway, Render, Fly.io, VPS**, etc. Set **`VITE_API_URL`** to that API’s **HTTPS** base URL. Update Google OAuth origins for both the frontend URL and the API callback URL.
2. **Single server (closest to “one localhost”):** Deploy **one** Node service that runs **`server/server.js`** after building the client. The server already serves **`dist/`** (see `express.static` in `server.js`) and falls back to `index.html` for SPA routes — **same origin** for UI and API, so you often omit **`VITE_API_URL`** or set it to the same origin. You still need a host that runs Node 24/7 (not Cloudflare Pages alone).

Understanding this explains blank pages (wrong `dist` folder), auth issues (API URL / OAuth still pointing at localhost), and why “two terminals locally” becomes “two services on the internet” unless you use option 2.

**Google sign-in on Cloudflare Pages / Vercel:** The “Sign in with Google” button must open your **deployed API** (`/auth/google` on Express), not the static site. Set **`VITE_API_URL`** in the frontend project to that API’s HTTPS origin (even if you later use a single Node server for both UI and API, set it to the same public URL). Redeploy the frontend after adding it. Without this, the app cannot start OAuth.

## Deploy on Vercel

1. Push this repo to GitHub (already configured for [ServerSide](https://github.com/husamalahmadi/ServerSide)).
2. In [Vercel](https://vercel.com), **Add New Project** → import **ServerSide**.
3. Vercel reads `vercel.json` (`dist` as the build output, SPA rewrites for React Router). Root directory: **.** (repo root).
4. Under **Environment Variables**, add the same keys as in [`.env.example`](.env.example). At minimum set **`VITE_TWELVEDATA_API_KEY`**. Set **`VITE_API_URL`** to your deployed API base URL (not `localhost`) if you use auth, comments, or watchlists.
5. Deploy. After the first deploy, add your Vercel URL to Google OAuth **Authorized JavaScript origins** and **redirect URIs** if you use Google sign-in through your API.

The Express API in `server/` is not run by Vercel; host it separately (e.g. Railway, Render) and point `VITE_API_URL` at it.

## Deploy on Cloudflare Pages (instead of Vercel)

1. **Account** — Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free tier is enough).

2. **Create a Pages project** — **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → authorize GitHub and select the **ServerSide** repo.

3. **Build settings** (first screen after picking the repo):
   - **Framework preset:** **Vite** (recommended) or **None**.
   - **Build command:** `npm run build`
   - **Build output directory:** **`dist`** — must match this repo (not `output`). If this is wrong, the site deploys without JS and shows a **blank page**.
   - **Root directory:** `/` (repo root).
   - Optional: set **Environment variable** `NODE_VERSION` = `20` if the build fails on an old Node image.

4. **Environment variables** — **Settings → Environment variables** (or add during setup). Add the same keys as [`.env.example`](.env.example). At minimum **`VITE_TWELVEDATA_API_KEY`**. Set **`VITE_API_URL`** to your deployed API base URL (HTTPS) if you use auth, comments, or watchlists — not `localhost`.

5. **Deploy** — Save and deploy. The file [`public/_redirects`](public/_redirects) is copied into `dist/` and tells Pages to serve `index.html` for client-side routes (React Router).

**Blank page after deploy?** In the browser, open **Developer tools → Network**, reload, and check `index.html` and `/assets/*.js`. If JS returns **HTML** instead of JavaScript, fix **Build output directory** to `dist`. If `index.html` references `/src/main.jsx`, the static deploy did not run `npm run build` or pointed at the wrong folder.

**`Output directory "dist" not found`?**  
1) **Settings → Builds:** **Build command** = `npm run build` or `npx vite build` (not empty). **Build output directory** = `dist`. **Root directory** = `/` (repo root, not `server/`).  
2) Deploy the **latest** `main` — if the log shows `HEAD is now at` an old commit, reconnect the branch or **Create deployment** from the newest commit.  
3) `vite.config.mjs` includes a small plugin that copies `output/` → `dist/` inside `vite build` when an older config only emitted `output/`.

6. **Custom domain** (optional) — **Custom domains** in the Pages project → add your domain and follow DNS instructions.

7. **Leaving Vercel** — You can delete the Vercel project or leave it; `vercel.json` is ignored by Cloudflare. The API in `server/` still must be hosted separately; point `VITE_API_URL` at it and update Google OAuth origins for your **Pages** URL.
