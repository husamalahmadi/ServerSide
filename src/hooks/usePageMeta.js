import { useEffect } from "react";
import {
  DEFAULT_META_DESCRIPTION,
  formatMetaDescription,
} from "../seo/pageDescriptions.js";
import {
  DEFAULT_DOCUMENT_TITLE,
  formatDocumentTitle,
} from "../seo/pageTitles.js";
const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://trueprice.cash").replace(/\/+$/, "");

function setMeta(name, content, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content || "");
}

function setLink(rel, href, hreflang) {
  if (!href) return;
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (hreflang) el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id, payload) {
  if (!id) return;
  let el = document.querySelector(`script[type="application/ld+json"][data-id="${id}"]`);
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.dataset.id = id;
    document.head.appendChild(el);
  }
  el.text = JSON.stringify(payload);
}

function removeJsonLd(id) {
  if (!id) return;
  document.querySelector(`script[type="application/ld+json"][data-id="${id}"]`)?.remove();
}

function absUrl(pathname = "/") {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_URL}${p}`;
}

/**
 * Sets document.title, canonical/hreflang and description + og tags for the current page.
 * @param {object} opts
 * @param {string} [opts.title] route label (formatted to 50–60 chars unless documentTitle set)
 * @param {string} [opts.documentTitle] full <title> string (50–60 chars); takes precedence
 * @param {string} [opts.metaDescription] full meta description (120–160 chars); takes precedence
 */
export function usePageMeta({
  title,
  documentTitle,
  description,
  metaDescription,
  pathname = "/",
  alternates = null,
  jsonLd = null,
} = {}) {
  useEffect(() => {
    const newTitle = documentTitle || formatDocumentTitle(title);
    const newDesc = metaDescription || formatMetaDescription(description);
    const canonical = absUrl(pathname);

    document.title = newTitle;
    setMeta("description", newDesc);
    setMeta("og:title", newTitle, true);
    setMeta("og:description", newDesc, true);
    setMeta("og:url", canonical, true);
    setLink("canonical", canonical);

    if (alternates && typeof alternates === "object") {
      Object.entries(alternates).forEach(([lang, hrefPath]) => {
        setLink("alternate", absUrl(hrefPath), lang);
      });
    }

    if (jsonLd) {
      setJsonLd("page-seo", jsonLd);
    } else {
      removeJsonLd("page-seo");
    }

    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE;
      setMeta("description", DEFAULT_META_DESCRIPTION);
      setMeta("og:title", DEFAULT_DOCUMENT_TITLE, true);
      setMeta("og:description", DEFAULT_META_DESCRIPTION, true);
      setMeta("og:url", absUrl("/"), true);
      setLink("canonical", absUrl("/"));
      removeJsonLd("page-seo");
    };
  }, [title, documentTitle, description, metaDescription, pathname, alternates, jsonLd]);
}
