import { DEFAULT_META_DESCRIPTION, formatMetaDescription } from "./pageDescriptions.js";
import { DEFAULT_DOCUMENT_TITLE, formatDocumentTitle } from "./pageTitles.js";
import { getSeoSiteUrl } from "./siteUrl.js";

function toAbs(pathname = "/") {
  const siteUrl = getSeoSiteUrl();
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteUrl}${p}`;
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
            "Fair value stock analysis and screener for US, Saudi (TASI), Tokyo, and London markets — market-focus presets and investing blogs.",
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
  const displayTicker = String(ticker || "").trim();
  const symbol = displayTicker.toUpperCase();
  const name = companyName || displayTicker || symbol;
  const pagePath = `/stock/${encodeURIComponent(displayTicker)}`;
  const pageUrl = toAbs(pagePath);
  const inLanguage = lang === "ar" ? "ar" : "en";
  const heading =
    lang === "ar"
      ? `تحليل سهم ${name} (${displayTicker}) والقيمة العادلة والبيانات المالية`
      : `${name} (${displayTicker}) Stock Analysis, Fair Value & Financials`;
  const documentTitle = formatDocumentTitle(
    lang === "ar"
      ? `${displayTicker} – ${name} القيمة العادلة والبيانات المالية`
      : `${displayTicker} – ${name} Fair Value & Financial Statements`
  );
  const description = formatMetaDescription(
    lang === "ar"
      ? `تحليل ${name} (${displayTicker}) على TruePrice.Cash: السعر، القيمة العادلة، القوائم المالية والمؤشرات الأساسية للمستثمرين في السوق السعودي والعالمي.`
      : `Analyze ${name} (${displayTicker}) on TruePrice.Cash with live price, fair value estimate, financial statements, and key metrics for investors.`
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
            name: `${name} (${displayTicker})`,
          },
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${pageUrl}#breadcrumb`,
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: toAbs("/") },
            { "@type": "ListItem", position: 2, name: "Stock Analysis", item: toAbs("/stock") },
            { "@type": "ListItem", position: 3, name: `${name} (${displayTicker})`, item: pageUrl },
          ],
        },
        {
          "@type": "FinancialService",
          "@id": `${pageUrl}#financial`,
          name: `${name} (${displayTicker})`,
          areaServed:
            market === "sa"
              ? "Saudi Arabia"
              : market === "jp"
                ? "Japan"
                : market === "uk"
                  ? "United Kingdom"
                  : "United States",
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

function stripTutorialTitle(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTutorialsIndexSeo({ articles = [], lang = "en" }) {
  const isAr = lang === "ar";
  const heading = isAr ? "دروس التحليل الأساسي" : "Fundamental Analysis Tutorials";
  const description = formatMetaDescription(
    isAr
      ? "أدلة مجانية خطوة بخطوة في التحليل الأساسي: قائمة الدخل، الميزانية، التدفقات النقدية، النسب، تقييم DCF، الخندق التنافسي، وإشارات الخطر."
      : "Free step-by-step guides on fundamental analysis: income statements, balance sheets, cash flow, ratios, DCF valuation, moats, and red flags for US, TASI, Tokyo, and London investors."
  );
  const documentTitle = formatDocumentTitle(
    isAr ? "دروس التحليل الأساسي – TruePrice.Cash" : "Fundamental Analysis Tutorials – TruePrice.Cash"
  );

  const indexPath = isAr ? "/ar/tutorials" : "/en/tutorials";
  const listId = `${toAbs(indexPath)}#list`;
  const itemListElement = articles.map((a, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: toAbs(`${isAr ? "/ar" : "/en"}/tutorials/${a.slug}`),
    name: stripTutorialTitle(a.titleHtml),
  }));

  const inLanguage = isAr ? "ar" : "en";

  return {
    title: heading,
    documentTitle,
    metaDescription: description,
    description,
    pathname: indexPath,
    alternates: {
      en: "/en/tutorials",
      ar: "/ar/tutorials",
      "x-default": "/en/tutorials",
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": listId,
          url: toAbs(indexPath),
          name: heading,
          description,
          inLanguage,
          isPartOf: {
            "@type": "WebSite",
            "@id": `${toAbs("/")}#website`,
            url: toAbs("/"),
            name: "TruePrice.Cash",
          },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: articles.length,
            itemListElement,
          },
        },
        ...articles.map((a) => {
          const articlePath = `${isAr ? "/ar" : "/en"}/tutorials/${a.slug}`;
          return {
          "@type": "LearningResource",
          "@id": `${toAbs(articlePath)}#article`,
          url: toAbs(articlePath),
          name: stripTutorialTitle(a.titleHtml),
          description: a.metaDescription || a.subtitle,
          inLanguage,
          learningResourceType: "Tutorial",
          isPartOf: { "@id": listId },
          publisher: {
            "@type": "Organization",
            name: "TruePrice.Cash",
            url: toAbs("/"),
          },
        };
        }),
      ],
    },
  };
}

export function buildTutorialArticleSeo({ article, lang = "en" }) {
  const isAr = lang === "ar";
  const pathname = `${isAr ? "/ar" : "/en"}/tutorials/${article.slug}`;
  const headline = stripTutorialTitle(article.titleHtml);
  const description = formatMetaDescription(article.metaDescription || article.subtitle);
  const documentTitle =
    article.documentTitle ||
    formatDocumentTitle(
      isAr ? `${headline} – دروس TruePrice.Cash` : `${headline} – TruePrice.Cash Tutorials`
    );

  const tutorialsLabel = isAr ? "الدروس" : "Tutorials";
  const homeLabel = isAr ? "الرئيسية" : "Home";

  return {
    title: headline,
    documentTitle,
    metaDescription: description,
    description,
    pathname,
    alternates: {
      en: `/en/tutorials/${article.slug}`,
      ar: `/ar/tutorials/${article.slug}`,
      "x-default": `/en/tutorials/${article.slug}`,
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          "@id": `${toAbs(pathname)}#article`,
          headline,
          description,
          url: toAbs(pathname),
          inLanguage: isAr ? "ar" : "en",
          isPartOf: {
            "@type": "CollectionPage",
            url: toAbs(isAr ? "/ar/tutorials" : "/en/tutorials"),
            name: isAr ? "دروس التحليل الأساسي" : "Fundamental Analysis Tutorials",
          },
          publisher: {
            "@type": "Organization",
            name: "TruePrice.Cash",
            url: toAbs("/"),
          },
          author: {
            "@type": "Organization",
            name: "TruePrice.Cash",
            url: toAbs("/"),
          },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: homeLabel, item: toAbs("/") },
            { "@type": "ListItem", position: 2, name: tutorialsLabel, item: toAbs(isAr ? "/ar/tutorials" : "/en/tutorials") },
            { "@type": "ListItem", position: 3, name: headline, item: toAbs(pathname) },
          ],
        },
      ],
    },
  };
}
