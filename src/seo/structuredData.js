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
          "حلل الأسهم الأمريكية والسعودية واليابانية على TruePrice.Cash — قيمة عادلة، قوائم مالية، أساسيات، وفلتر أسهم للمستثمرين في الأسواق العالمية."
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
            "Institutional-grade stock analysis with fair value estimates for US, Saudi (TASI), and Tokyo markets.",
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

export function buildBlogsSeo({ lang, postsCount }) {
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
          "@id": `${toAbs("/blogs")}#blog`,
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
            numberOfItems: Number(postsCount) || 0,
          },
        },
      ],
    },
  };
}
