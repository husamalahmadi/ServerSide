const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://trueprice.cash").replace(/\/+$/, "");

function toAbs(pathname = "/") {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_URL}${p}`;
}

export function buildStockSeo({ ticker, companyName, lang, fairValue, price, currency, market }) {
  const symbol = String(ticker || "").toUpperCase();
  const name = companyName || symbol;
  const pagePath = `/stock/${encodeURIComponent(symbol)}`;
  const pageUrl = toAbs(pagePath);
  const inLanguage = lang === "ar" ? "ar" : "en";
  const title = lang === "ar"
    ? `تحليل سهم ${name} (${symbol}) والقيمة العادلة والبيانات المالية`
    : `${name} (${symbol}) Stock Analysis, Fair Value & Financials`;
  const description = lang === "ar"
    ? `تحليل سهم ${name} (${symbol}) يشمل السعر الحالي والقيمة العادلة والبيانات المالية الأساسية.`
    : `Stock analysis for ${name} (${symbol}) with current price, fair value estimate, and key financial statements.`;

  return {
    title,
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
          name: title,
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
          areaServed: market === "sa" ? "Saudi Arabia" : "United States",
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
  const title = lang === "ar" ? "مدونة TruePrice.Cash للاستثمار" : "TruePrice.Cash Investing Blog";
  const description = lang === "ar"
    ? "مقالات عن الاستثمار في سوق الأسهم السعودي والتقييم المالي وقراءة النتائج."
    : "Articles on TASI investing, valuation basics, and earnings commentary.";
  return {
    title,
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
          name: title,
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
          name: title,
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
