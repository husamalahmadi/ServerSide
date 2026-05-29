import { DEFAULT_META_DESCRIPTION, formatMetaDescription } from "./pageDescriptions.js";
import { DEFAULT_DOCUMENT_TITLE, formatDocumentTitle } from "./pageTitles.js";

const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://trueprice.cash").replace(/\/+$/, "");

function toAbs(pathname = "/") {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_URL}${p}`;
}

/** Homepage WebSite schema (crawlable + supports stock URL pattern). */
export function buildHomeSeo(lang = "en") {
  const homeUrl = toAbs("/");
  const metaDescription =
    lang === "ar"
      ? formatMetaDescription(
          "فلتر أسهم TruePrice.Cash لأسواق أمريكا والسعودية (تداول) واليابان — قيمة عادلة، فلاتر تداول واليابان، مدونات، وأساسيات للمستثمرين."
        )
      : DEFAULT_META_DESCRIPTION;
  return {
    documentTitle: DEFAULT_DOCUMENT_TITLE,
    metaDescription,
    title: "",
    description: metaDescription,
    pathname: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${homeUrl}#website`,
          url: homeUrl,
          name: "TruePrice.Cash",
          description:
            "Fair value stock analysis and screener for US, Saudi (TASI), and Tokyo markets — TASI Focus, Tokyo Focus, and investing blogs.",
          inLanguage: ["en", "ar"],
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${homeUrl}stock/{search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        },
        {
          "@type": "Organization",
          "@id": `${homeUrl}#organization`,
          name: "TruePrice.Cash",
          url: homeUrl,
        },
      ],
    },
  };
}

export function buildStockSeo({ ticker, companyName, lang, fairValue, price, currency, market }) {
  const symbol = String(ticker || "").toUpperCase();
  const name = companyName || symbol;
  const pagePath = `/stock/${encodeURIComponent(symbol)}`;
  const pageUrl = toAbs(pagePath);
  const inLanguage = lang === "ar" ? "ar" : "en";
  const heading = lang === "ar"
    ? `تحليل سهم ${name} (${symbol}) والقيمة العادلة والبيانات المالية`
    : `${name} (${symbol}) Stock Analysis, Fair Value & Financials`;
  const documentTitle = formatDocumentTitle(
    lang === "ar"
      ? `${symbol} – ${name} القيمة العادلة والبيانات المالية`
      : `${symbol} – ${name} Fair Value & Financial Statements`
  );
  const description = formatMetaDescription(
    lang === "ar"
      ? `تحليل ${name} (${symbol}) على TruePrice.Cash: السعر، القيمة العادلة، القوائم المالية والمؤشرات الأساسية للمستثمرين في السوق السعودي والعالمي.`
      : `Analyze ${name} (${symbol}) on TruePrice.Cash with live price, fair value estimate, financial statements, and key metrics for investors.`
  );

  return {
    title: heading,
    documentTitle,
    metaDescription: description,
    description,
    pathname: pagePath,
    alternates: {
      en: `${pagePath}?lang=en`,
      ar: `${pagePath}?lang=ar`,
      "x-default": pagePath,
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${pageUrl}#webpage`,
          url: pageUrl,
          name: heading,
          description,
          inLanguage,
          isPartOf: {
            "@type": "WebSite",
            "@id": `${toAbs("/")}#website`,
            url: toAbs("/"),
            name: "TruePrice.Cash",
          },
          about: {
            "@type": "Thing",
            name: `${name} (${symbol})`,
          },
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${pageUrl}#breadcrumb`,
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: toAbs("/") },
            { "@type": "ListItem", position: 2, name: "Stock Analysis", item: toAbs("/stock") },
            { "@type": "ListItem", position: 3, name: `${name} (${symbol})`, item: pageUrl },
          ],
        },
        {
          "@type": "FinancialService",
          "@id": `${pageUrl}#financial`,
          name: `${name} (${symbol})`,
          areaServed:
            market === "sa" ? "Saudi Arabia" : market === "jp" ? "Japan" : "United States",
          provider: {
            "@type": "Organization",
            name: "TruePrice.Cash",
            url: toAbs("/"),
          },
          offers: {
            "@type": "Offer",
            priceCurrency: currency || "USD",
            category: "Stock valuation insight",
          },
          additionalProperty: [
            {
              "@type": "PropertyValue",
              name: "Current Price",
              value: Number.isFinite(Number(price)) ? Number(price) : null,
            },
            {
              "@type": "PropertyValue",
              name: "Estimated Fair Value",
              value: Number.isFinite(Number(fairValue)) ? Number(fairValue) : null,
            },
          ],
        },
      ],
    },
  };
}

/** Safely convert a Date or date string to an ISO string (or null). */
function toIsoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function buildBlogsSeo({ lang, posts = [], postsCount }) {
  const inLanguage = lang === "ar" ? "ar" : "en";
  const heading = lang === "ar" ? "مدونة TruePrice.Cash للاستثمار" : "TruePrice.Cash Investing Blog";
  const description = formatMetaDescription(
    lang === "ar"
      ? "مدونة TruePrice.Cash: مقالات عن استثمار تداول والأسهم الأمريكية واليابانية، أساسيات التقييم، قراءة الأرباح، ونصائح للمستثمرين العرب والعالميين."
      : "TruePrice.Cash blog: articles on TASI, US, and Tokyo investing, valuation basics, earnings commentary, and practical tips for individual investors."
  );
  const documentTitle = formatDocumentTitle(
    lang === "ar"
      ? "مدونة TruePrice.Cash – رؤى أسهم تداول وأمريكا واليابان"
      : "TruePrice.Cash Blog – US, TASI & Tokyo Stock Insights"
  );

  const blogId = `${toAbs("/blogs")}#blog`;
  const safePosts = Array.isArray(posts) ? posts.filter((p) => p && (p.title || p.url)) : [];

  // Per-post BlogPosting nodes (improves Google News / article discovery).
  const postingNodes = safePosts.map((post, i) => {
    const headline = String(post.title || "").trim().slice(0, 110) || `${heading} #${i + 1}`;
    const url = post.url || toAbs("/blogs");
    const datePublished = toIsoDate(post.published);
    const dateModified = toIsoDate(post.updated) || datePublished;
    const node = {
      "@type": "BlogPosting",
      "@id": `${toAbs("/blogs")}#post-${post.id || i + 1}`,
      headline,
      url,
      mainEntityOfPage: url,
      inLanguage,
      isPartOf: { "@id": blogId },
      publisher: {
        "@type": "Organization",
        name: "TruePrice.Cash",
        url: toAbs("/"),
      },
      author: post.author
        ? { "@type": "Person", name: post.author }
        : { "@type": "Organization", name: "TruePrice.Cash", url: toAbs("/") },
    };
    if (datePublished) node.datePublished = datePublished;
    if (dateModified) node.dateModified = dateModified;
    return node;
  });

  const itemListElement = postingNodes.map((node, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: node.url,
  }));

  return {
    title: heading,
    documentTitle,
    metaDescription: description,
    description,
    pathname: "/blogs",
    alternates: {
      en: "/blogs?lang=en",
      ar: "/blogs?lang=ar",
      "x-default": "/blogs",
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Blog",
          "@id": blogId,
          url: toAbs("/blogs"),
          name: heading,
          description,
          inLanguage,
          publisher: {
            "@type": "Organization",
            name: "TruePrice.Cash",
            url: toAbs("/"),
          },
        },
        {
          "@type": "CollectionPage",
          "@id": `${toAbs("/blogs")}#collection`,
          url: toAbs("/blogs"),
          name: heading,
          isPartOf: {
            "@type": "WebSite",
            "@id": `${toAbs("/")}#website`,
            url: toAbs("/"),
            name: "TruePrice.Cash",
          },
          inLanguage,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: Number(postsCount) || safePosts.length,
            ...(itemListElement.length ? { itemListElement } : {}),
          },
        },
        ...postingNodes,
      ],
    },
  };
}
