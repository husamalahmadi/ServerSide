function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text) {
  return escapeHtml(text);
}

function absUrl(siteOrigin, pathOrUrl) {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return siteOrigin;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${siteOrigin.replace(/\/+$/, "")}${path}`;
}

function buildHreflangBlock(siteOrigin, alternates) {
  if (!alternates || typeof alternates !== "object") return "";
  return Object.entries(alternates)
    .map(
      ([lang, hrefPath]) =>
        `<link rel="alternate" hreflang="${escapeAttr(lang)}" href="${escapeAttr(absUrl(siteOrigin, hrefPath))}" />`
    )
    .join("\n    ");
}

/**
 * Inject per-page SEO into the SPA index.html template (initial HTML for crawlers).
 * @param {string} html
 * @param {object} seo from buildStockSeo / buildHomeSeo
 * @param {string} siteOrigin e.g. https://trueprice.cash
 * @param {string} canonical absolute canonical URL
 * @param {{ staticFallbackHtml?: string }} opts
 */
export function injectSeoIntoSpaHtml(html, seo, siteOrigin, canonical, opts = {}) {
  if (!seo?.documentTitle) return html;

  let out = html;

  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.documentTitle)}</title>`);

  out = out.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/i,
    `$1${escapeAttr(seo.metaDescription)}$2`
  );

  out = out.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/i,
    `$1${escapeAttr(seo.documentTitle)}$2`
  );

  out = out.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/i,
    `$1${escapeAttr(seo.metaDescription)}$2`
  );

  out = out.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/i,
    `$1${escapeAttr(canonical)}$2`
  );

  out = out.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/i,
    `$1${escapeAttr(canonical)}$2`
  );

  out = out.replace(/<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>\s*/gi, "");

  const hreflangBlock = buildHreflangBlock(siteOrigin, seo.alternates);
  if (hreflangBlock) {
    out = out.replace(/(<link\s+rel="canonical"[^>]*>)/i, `$1\n    ${hreflangBlock}`);
  }

  const jsonLd = JSON.stringify(seo.jsonLd).replace(/</g, "\\u003c");
  out = out.replace(
    /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json">${jsonLd}</script>`
  );

  if (opts.staticFallbackHtml) {
    out = out.replace(/<main id="tp-static-fallback"[\s\S]*?<\/main>/i, opts.staticFallbackHtml);
  }

  return out;
}

const MARKET_LABEL = {
  en: {
    us: "US market (S&P 500)",
    sa: "TASI — Saudi Arabia",
    jp: "Tokyo Stock Exchange",
    uk: "London Stock Exchange",
  },
  ar: {
    us: "السوق الأمريكي (S&P 500)",
    sa: "تداول — السعودية",
    jp: "بورصة طوكيو",
    uk: "بورصة لندن",
  },
};

/**
 * Noscript / crawler-visible main block for /stock/:ticker requests.
 */
export function buildStockStaticFallback({ hit, market, lang, seo }) {
  const isAr = lang === "ar";
  const ticker = escapeHtml(hit.ticker);
  const name = escapeHtml(hit.name);
  const marketLabel = escapeHtml(MARKET_LABEL[isAr ? "ar" : "en"][market] || market);
  const industry = hit.industry ? escapeHtml(hit.industry) : "";
  const description = escapeHtml(seo?.metaDescription || seo?.description || "");
  const subhead = industry
    ? isAr
      ? `${marketLabel} · ${industry}`
      : `${marketLabel} · ${industry}`
    : marketLabel;

  return `<main id="tp-static-fallback" class="tp-static-shell" aria-hidden="true">
      <h1 class="tp-static-hero">${name} (${ticker})</h1>
      <p>${description}</p>
      <p class="tp-static-subhead">${subhead}</p>
      <nav aria-label="Site">
        <a href="/">Home</a>
        <a href="/blogs">Blogs</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/sitemap.xml">Sitemap</a>
        <a href="/stock/AAPL">Apple (AAPL)</a>
        <a href="/stock/2222">Saudi Aramco (2222)</a>
        <a href="/stock/7203.T">Toyota (7203.T)</a>
        <a href="/stock/GLEN.L">Glencore (GLEN.L)</a>
      </nav>
    </main>`;
}
