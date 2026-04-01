# ServerSide

Stocks financials web app (Vite + React). The production build is written to `output/`.

## Deploy on Vercel

1. Push this repo to GitHub (already configured for [ServerSide](https://github.com/husamalahmadi/ServerSide)).
2. In [Vercel](https://vercel.com), **Add New Project** → import **ServerSide**.
3. Vercel reads `vercel.json` (`output` as the build output, SPA rewrites for React Router). Root directory: **.** (repo root).
4. Under **Environment Variables**, add the same keys as in [`.env.example`](.env.example). At minimum set **`VITE_TWELVEDATA_API_KEY`**. Set **`VITE_API_URL`** to your deployed API base URL (not `localhost`) if you use auth, comments, or watchlists.
5. Deploy. After the first deploy, add your Vercel URL to Google OAuth **Authorized JavaScript origins** and **redirect URIs** if you use Google sign-in through your API.

The Express API in `server/` is not run by Vercel; host it separately (e.g. Railway, Render) and point `VITE_API_URL` at it.

## Deploy on Cloudflare Pages (instead of Vercel)

1. **Account** — Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free tier is enough).

2. **Create a Pages project** — **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → authorize GitHub and select the **ServerSide** repo.

3. **Build settings** (first screen after picking the repo):
   - **Framework preset:** None / Vite (either is fine).
   - **Build command:** `npm run build`
   - **Build output directory:** `output`
   - **Root directory:** `/` (repo root).

4. **Environment variables** — **Settings → Environment variables** (or add during setup). Add the same keys as [`.env.example`](.env.example). At minimum **`VITE_TWELVEDATA_API_KEY`**. Set **`VITE_API_URL`** to your deployed API base URL (HTTPS) if you use auth, comments, or watchlists — not `localhost`.

5. **Deploy** — Save and deploy. The file [`public/_redirects`](public/_redirects) is copied into `output/` and tells Pages to serve `index.html` for client-side routes (React Router).

6. **Custom domain** (optional) — **Custom domains** in the Pages project → add your domain and follow DNS instructions.

7. **Leaving Vercel** — You can delete the Vercel project or leave it; `vercel.json` is ignored by Cloudflare. The API in `server/` still must be hosted separately; point `VITE_API_URL` at it and update Google OAuth origins for your **Pages** URL.
