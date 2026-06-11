/**
 * Sanitize HTML before rendering to prevent XSS.
 * Use for any user or API content (e.g. blog posts) that may be rendered as HTML.
 */

import DOMPurify from "dompurify";

const defaultConfig = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "a", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "code", "pre"],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

/** Trusted synced blog HTML — allows layout/styling tags; scripts are always stripped. */
export const BLOG_HTML_CONFIG = {
  ADD_TAGS: ["style"],
  ALLOWED_TAGS: [
    "style", "div", "span", "section", "article", "header", "footer", "aside", "main", "nav",
    "p", "br", "strong", "em", "u", "b", "i", "a", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
    "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td",
    "canvas", "time", "sup", "sub", "hr", "small", "label",
  ],
  ALLOWED_ATTR: [
    "href", "target", "rel", "class", "id", "style", "src", "alt", "title",
    "role", "aria-label", "aria-hidden", "datetime", "colspan", "rowspan",
    "loading", "width", "height", "dir", "lang",
  ],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button"],
};

/**
 * Returns sanitized HTML safe to render with dangerouslySetInnerHTML.
 * @param {string} dirty - Raw HTML string
 * @param {object} config - Optional DOMPurify config override
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(dirty, config = {}) {
  if (typeof dirty !== "string" || !dirty.trim()) return "";
  return DOMPurify.sanitize(dirty, { ...defaultConfig, ...config });
}

/**
 * Strip HTML tags and return plain text (safe for parsing; uses sanitized HTML internally).
 */
export function stripHtmlToText(html) {
  if (typeof html !== "string" || !html.trim()) return "";
  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const safe = sanitizeHtml(html);
  const tmp = document.createElement("div");
  tmp.innerHTML = safe;
  return (tmp.textContent || tmp.innerText || "").trim();
}
