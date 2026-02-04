/**
 * Sanitize HTML before rendering to prevent XSS.
 * Use for any user or API content (e.g. blog posts) that may be rendered as HTML.
 */

import DOMPurify from "dompurify";

const defaultConfig = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "a", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "code", "pre"],
  ALLOWED_ATTR: ["href", "target", "rel"],
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
