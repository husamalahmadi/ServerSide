# TruePrice.Cash Growth SEO Playbook

This keeps the same product idea (fundamentals-driven stock analysis) and turns it into an SEO distribution engine.

## Implementation status (code-side)

Done in the app:

- [x] Stock profile narrative on every `/stock/:ticker` page (Section 1.4)
- [x] Stock page structured data: `WebPage` + `BreadcrumbList` + `FinancialService` JSON-LD (Section 1.5)
- [x] Arabic/English keyword headings for stock pages (Section 1)
- [x] Blog listing structured data: `Blog` + `CollectionPage` JSON-LD
- [x] Per-post `BlogPosting` JSON-LD with headline, URL, author, publish/modify dates (Section 5 — Google News readiness)
- [x] Author names + publish dates shown on each post (Section 5)
- [x] Sitemap auto-generated on build, now including `/us-markets` and `/sa-markets` landing pages (Section 5)
- [x] Investor traffic dashboard link via `VITE_PUBLIC_TRAFFIC_DASHBOARD_URL` on the About page (Section 6)

Operational (manual, not code — owners must execute):

- [x] Retire the 50 generic Arabic explainers. Pages below are built from the TASI catalog and the fair-value cache (Section 2).
- [ ] Search Console: submit `https://trueprice.cash/sitemap.xml` so `sitemap-tasi.xml` is discovered (Section 5)
- [ ] cron-job.org: `POST /api/internal/publish-earnings` every 2 hours, and `POST /api/internal/daily-gap-post` once a day, header `x-internal-token` (Section 7)
- [ ] Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `X_USER_ACCESS_TOKEN` if those posts should leave the server (Section 7)
- [ ] Backlink outreach with one fresh number, not a pitch for the site (Section 4)
- [ ] Build/maintain the public Notion traffic dashboard (Section 6)

## 1) Templated stock profile pages

Use each stock page (`/stock/:ticker`) as a dedicated landing page for:

- Arabic intent: "تحليل سهم [company] ([ticker])"
- English intent: "[Company] ([Ticker]) Stock Analysis"

Required blocks on every stock page:

1. Executive summary (already present)
2. Fair value vs current price (already present)
3. Financial trends (already present)
4. A short "Stock Profile" narrative (added)
5. Structured data JSON-LD (added)

## 2) Programmatic Arabic pages (replaces the 50 generic posts)

Clusters A–E (generic explainers such as "ما هي القيمة العادلة للسهم؟") are retired. Argaam, Mubasher, and Sabq already own those queries. These URLs carry the numbers the screener already computes, and they refresh when that cache refreshes:

- `/ar/tasi/أسهم-أقل-من-قيمتها-العادلة` — TASI names whose fair value sits above the price
- `/ar/sa-markets/:sector` — one page per TASI sector in `tasi_grouped_by_industry.json`
- `/ar/compare/:a-vs-:b` — a name versus the next three tickers in the same sector (canonical order is the lower ticker first)
- `/ar/tasi/نتائج-الشركات` — every TASI name, with a commentary link after a new period is stored
- `/ar/tasi/نتائج/:ticker/:period` — commentary from revenue, net income, EPS, and the fair-value gap. Missing figures stay an em dash.

`sitemap-tasi.xml` lists the undervalued page, the calendar, each sector, and the compare pairs.

## 3) What a commentary page contains

- Company, ticker, period end date
- Revenue, net income, EPS (only when the source has them)
- Price, fair value, and gap when the screener cache has both price and fair value
- Links to the stock page and the sector page
- The fair-value disclaimer

## 4) Backlink outreach

Weekly target: 20 messages. Pitch one number from the day's gap post, not the homepage.

Priority:
- Saudi finance newsletters
- University investment clubs
- Arab finance creators, after the card is already public

Message shape:

> اليوم أكبر فجوة قيمة عادلة في تاسي على TruePrice.Cash هي {company} ({ticker}) عند {gap}. البطاقة مرفقة. المصدر: {stockUrl}

Take `{company}`, `{ticker}`, `{gap}`, and `{stockUrl}` from `POST /api/internal/daily-gap-post`. Do not invent a figure if that route returns `no_priced_tasi_rows`.

Track: contact, date, status, link acquired.

## 5) Google News readiness checklist

- Consistent publishing schedule
- Author names and publish dates on each post
- Editorial pages available: About / Contact
- News-focused article formatting (clear headline + timely summary)
- Keep sitemap updated and submit in Search Console

## 6) Public traffic dashboard (investors)

Use Notion (public page) and update weekly:
- GA4 users/sessions trend
- Top landing pages
- Top Arabic queries (from Search Console)
- Referring domains gained
- 30-day highlights and next actions

Optional placement in app:
- Set `VITE_PUBLIC_TRAFFIC_DASHBOARD_URL` to show an investor-facing link in About page.

## 7) Distribution

`POST /api/internal/daily-gap-post` picks the largest positive TASI fair-value gap and returns the Arabic caption plus the OG image URL from `/og/ar/stock/:ticker.png`.

- X: set `X_USER_ACCESS_TOKEN`. The tweet is the caption plus the stock URL, so the card is the page's `og:image`.
- Telegram: set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. The bot sends the image, not a bare link.
- WhatsApp groups have no post API. Send `groupCard.imageUrl` into the group by hand.
- Earnings: `POST /api/internal/publish-earnings` every 2 hours. It publishes when Financial Modeling Prep has a new period for a `.SR` symbol. FMP often lags Tadawul, so this is not a guarantee of two hours after the filing.
