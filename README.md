# ServerSide

Stocks financials web app (Vite + React). The production build is written to `output/`.

## Deploy on Vercel

1. Push this repo to GitHub (already configured for [ServerSide](https://github.com/husamalahmadi/ServerSide)).
2. In [Vercel](https://vercel.com), **Add New Project** → import **ServerSide**.
3. Vercel reads `vercel.json` (`output` as the build output, SPA rewrites for React Router). Root directory: **.** (repo root).
4. Under **Environment Variables**, add the same keys as in [`.env.example`](.env.example). At minimum set **`VITE_TWELVEDATA_API_KEY`**. Set **`VITE_API_URL`** to your deployed API base URL (not `localhost`) if you use auth, comments, or watchlists.
5. Deploy. After the first deploy, add your Vercel URL to Google OAuth **Authorized JavaScript origins** and **redirect URIs** if you use Google sign-in through your API.

The Express API in `server/` is not run by Vercel; host it separately (e.g. Railway, Render) and point `VITE_API_URL` at it.
