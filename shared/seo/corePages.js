import { formatMetaDescription, METHODOLOGY_META_DESCRIPTION } from "./pageDescriptions.js";
import { formatDocumentTitle, METHODOLOGY_DOCUMENT_TITLE } from "./pageTitles.js";
import { absoluteCanonicalUrl, canonicalPathname } from "./canonicalUrl.js";
import { getSeoSiteUrl } from "./siteUrl.js";

/** English copy for URLs that are not locale-prefixed. Matches the client English titles. */
const CORE_PAGES = {
  "/about": {
    documentTitle: "About TruePrice.Cash – Stock Fair Value Research Platform",
    metaDescription:
      "Learn about TruePrice.Cash — fair value stock research for US, Saudi (TASI), Tokyo, and London markets with financial statements, fundamentals, and screening tools.",
  },
  "/contact": {
    documentTitle: "Contact TruePrice.Cash – Investor Support & Inquiries",
    metaDescription:
      "Contact TruePrice.Cash for support and questions about US, TASI, Tokyo, and London stock analysis, fair value tools, and financial data on our platform.",
  },
  "/methodology": {
    documentTitle: METHODOLOGY_DOCUMENT_TITLE.en,
    metaDescription: METHODOLOGY_META_DESCRIPTION.en,
  },
  "/us-markets": {
    title: "US Stock Market Performance",
    description:
      "US sector and industry performance snapshots, biggest gainers and losers, and most active stocks on TruePrice.Cash.",
  },
  "/sa-markets": {
    title: "TASI Stock Market Performance",
    description: "TASI top gainers, losers, and most traded stocks on TruePrice.Cash.",
  },
};

/** Initial HTML for core routes. Null when the path is not one of those pages. */
export function buildCorePageSeo(pathname) {
  const path = canonicalPathname(pathname);
  const spec = CORE_PAGES[path];
  if (!spec) return null;

  const documentTitle = spec.documentTitle || formatDocumentTitle(spec.title, "en");
  const metaDescription = spec.metaDescription || formatMetaDescription(spec.description);
  const pageUrl = absoluteCanonicalUrl(getSeoSiteUrl(), path);

  return {
    documentTitle,
    metaDescription,
    description: metaDescription,
    pathname: path,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: documentTitle,
      description: metaDescription,
      inLanguage: "en",
      isPartOf: {
        "@type": "WebSite",
        name: "TruePrice.Cash",
        url: absoluteCanonicalUrl(getSeoSiteUrl(), "/"),
      },
    },
  };
}
