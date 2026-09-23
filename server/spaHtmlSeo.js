import { buildStockNarrative, stockNarrativeToStaticHtml } from "../shared/seo/stockNarrative.js";
import { DEFAULT_OG_IMAGE_PATH, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "../shared/seo/ogPaths.js";
import { stockPath } from "../shared/seo/stockPaths.js";

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

function upsertMeta(html, attr, key, content) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, "i");
  if (re.test(html)) return html.replace(re, `$1${escapeAttr(content)}$2`);
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(content)}" />`;
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
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

  const ogImage = absUrl(siteOrigin, seo.ogImage || DEFAULT_OG_IMAGE_PATH);
  const ogAlt = seo.ogImageAlt || seo.documentTitle;
  out = upsertMeta(out, "property", "og:image", ogImage);
  out = upsertMeta(out, "property", "og:image:secure_url", ogImage);
  out = upsertMeta(out, "property", "og:image:width", String(OG_IMAGE_WIDTH));
  out = upsertMeta(out, "property", "og:image:height", String(OG_IMAGE_HEIGHT));
  out = upsertMeta(out, "property", "og:image:type", "image/png");
  out = upsertMeta(out, "property", "og:image:alt", ogAlt);
  out = upsertMeta(out, "name", "twitter:card", "summary_large_image");
  out = upsertMeta(out, "name", "twitter:image", ogImage);
  out = upsertMeta(out, "name", "twitter:title", seo.documentTitle);
  out = upsertMeta(out, "name", "twitter:description", seo.metaDescription);

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
export function buildStockStaticFallback({ hit, market, lang, seo, currency }) {
  const isAr = lang === "ar";
  const ticker = escapeHtml(hit.ticker);
  const name = escapeHtml(hit.name);
  const marketLabel = escapeHtml(MARKET_LABEL[isAr ? "ar" : "en"][market] || market);
  const industry = hit.industry ? escapeHtml(hit.industry) : "";
  const subhead = industry
    ? isAr
      ? `${marketLabel} · ${industry}`
      : `${marketLabel} · ${industry}`
    : marketLabel;

  const narrative = buildStockNarrative({
    lang,
    ticker: hit.ticker,
    companyName: hit.name,
    market,
    industry: hit.industry || "",
    currency: currency || "USD",
  });
  const narrativeHtml = stockNarrativeToStaticHtml(narrative, escapeHtml);

  return `<main id="tp-static-fallback" class="tp-static-shell" aria-hidden="true">
      <h1 class="tp-static-hero">${name} (${ticker})</h1>
      <p class="tp-static-subhead">${subhead}</p>
      ${narrativeHtml}
      <nav aria-label="Site">
        <a href="/">${isAr ? "الرئيسية" : "Home"}</a>
        <a href="${isAr ? "/ar/blogs" : "/en/blogs"}">${isAr ? "المدونة" : "Blogs"}</a>
        <a href="/methodology">${isAr ? "المنهجية" : "Methodology"}</a>
        <a href="/about">${isAr ? "من نحن" : "About"}</a>
        <a href="/contact">${isAr ? "اتصل بنا" : "Contact"}</a>
        <a href="/sitemap.xml">Sitemap</a>
        <a href="${stockPath(isAr ? "ar" : "en", "AAPL")}">Apple (AAPL)</a>
        <a href="${stockPath(isAr ? "ar" : "en", "2222")}">Saudi Aramco (2222)</a>
        <a href="${stockPath(isAr ? "ar" : "en", "7203.T")}">Toyota (7203.T)</a>
        <a href="${stockPath(isAr ? "ar" : "en", "GLEN.L")}">Glencore (GLEN.L)</a>
      </nav>
    </main>`;
}
