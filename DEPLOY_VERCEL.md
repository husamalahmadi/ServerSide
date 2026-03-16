# Deploy TruePrice.Cash to Vercel (with analytics)

## 1. Connect your repo to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New** → **Project**
3. Import your `stocks-financials-app` repository
4. Vercel will auto-detect the build settings from `vercel.json`

## 2. Create a Vercel Blob store (for analytics)

1. In your Vercel project, go to **Storage** tab
2. Click **Create Database** → choose **Blob**
3. Name it (e.g. `analytics-store`) and create
4. Connect it to your project – Vercel will add `BLOB_READ_WRITE_TOKEN` automatically

## 3. Deploy

1. Click **Deploy**
2. After deployment, your site will be live at `your-project.vercel.app`
3. Point your custom domain `trueprice.cash` in **Settings** → **Domains**

## 4. View analytics

- **API:** `https://trueprice.cash/api/analytics` (GET)
- Opens in browser or use curl/fetch to see total hits, events, and user activity
